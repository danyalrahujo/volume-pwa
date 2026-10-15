import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where
} from "firebase/firestore";

import React, { useEffect, useMemo, useState } from "react";
import { auth, db, messaging } from "./firebase";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut
} from "firebase/auth";
import { getToken } from "firebase/messaging";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
// ============================================================
// HELPERS
// ============================================================

function sameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function startOfDay(date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function minutesToTime(minutes) {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;

  return `${String(hour).padStart(2, "0")}:${String(
    minute
  ).padStart(2, "0")}`;
}

function durationMinutes(start, end) {
  const difference = end - start;

  return difference > 0
    ? difference
    : difference + 1440;
}

function durationText(start, end) {
  const minutes = durationMinutes(start, end);

  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;

  if (remaining === 0) {
    return `${hours} h`;
  }

  return `${hours} h ${remaining} min`;
}

function formatHours(minutes) {
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;

  if (remaining === 0) {
    return `${hours} h`;
  }

  return `${hours} h ${remaining} min`;
}

function formatDateInput(date) {
  const year = date.getFullYear();

  const month = String(
    date.getMonth() + 1
  ).padStart(2, "0");

  const day = String(
    date.getDate()
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}
function isManagerProfile(profile) {
  return profile?.role === "manager";
}


// ============================================================
// APP
// ============================================================

function App() {

  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);

const [employees, setEmployees] = useState([]);
const [shifts, setShifts] = useState([]);
const [requests, setRequests] = useState([]);
const [notifications, setNotifications] =
  useState([]);

  const [loading, setLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState("");

  const [month, setMonth] = useState(
    new Date()
  );

  const [activeTab, setActiveTab] =
    useState("timetable");
    useEffect(() => {
  const handleServiceWorkerMessage = (event) => {
    if (event.data?.type === "VOLUME_NOTIFICATION_OPEN") {
      setActiveTab("timetable");
    }
  };

  navigator.serviceWorker?.addEventListener(
    "message",
    handleServiceWorkerMessage
  );

  return () => {
    navigator.serviceWorker?.removeEventListener(
      "message",
      handleServiceWorkerMessage
    );
  };
}, []);
    useEffect(() => {
  const handleNotificationOpen = () => {
    setActiveTab("timetable");
  };

  window.addEventListener("volume-notification-open", handleNotificationOpen);

  return () => {
    window.removeEventListener(
      "volume-notification-open",
      handleNotificationOpen
    );
  };
}, []);

  const [selectedShift, setSelectedShift] =
    useState(null);

  const [showEditor, setShowEditor] =
    useState(false);

  const [editorDate, setEditorDate] =
    useState(new Date());
    const [editorDepartment, setEditorDepartment] =
  useState("Bar");

  const [showAddEmployee, setShowAddEmployee] =
    useState(false);

  const [newEmployeeName, setNewEmployeeName] =
    useState("");
    const [newEmployeeEmail, setNewEmployeeEmail] =
  useState("");
    async function enablePushNotifications() {
    try {
      if (!("Notification" in window)) {
        console.log("Notifications are not supported.");
        return;
      }

      const permission =
        await Notification.requestPermission();

      if (permission !== "granted") {
        console.log("Notification permission not granted.");
        return;
      }

      const registration = await navigator.serviceWorker.register(
  "/volume-pwa/firebase-messaging-sw.js"
);

const token = await getToken(messaging, {
  vapidKey: "BNubueUytLgOiGi5nKi9X7cnpv-GwgQGAHoVjTFc-O_pTrMXz7tms67L5GkzXlAbPwBfBegnDvQ6xCAzrIaHeO4",
  serviceWorkerRegistration: registration
});

      if (!token) {
        console.log("Could not get FCM token.");
        return;
      }

await setDoc(
  doc(
    db,
    "users",
    user.uid,
    "pushTokens",
    encodeURIComponent(token)
  ),
  {
    token,
    platform: "web",
    userAgent: navigator.userAgent,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  },
  {
    merge: true
  }
);

console.log("FCM token saved successfully.");

    } catch (error) {
      console.error(
        "Push notification setup error:",
        error
      );
    }
  }

  // ==========================================================
  // AUTH
  // ==========================================================

  useEffect(() => {

    const unsubscribe =
      onAuthStateChanged(
        auth,
        (currentUser) => {

          setUser(currentUser);

          if (!currentUser) {

            setProfile(null);
            setEmployees([]);
            setShifts([]);
            setLoading(false);

            return;
          }

          setLoading(true);

          const profileRef =
            doc(
              db,
              "users",
              currentUser.uid
            );

          const unsubscribeProfile =
            onSnapshot(
              profileRef,
              (snapshot) => {

                if (snapshot.exists()) {

                  setProfile(
                    snapshot.data()
                  );

                  setError("");

                } else {

                  setProfile(null);

                  setError(
                    "Your VOLUME profile was not found."
                  );
                }

                setLoading(false);
              },
              (err) => {

                console.error(
                  "Profile error:",
                  err
                );

                setError(
                  "Could not load your VOLUME profile."
                );

                setLoading(false);
              }
            );

          // Store the profile listener so it can be
          // cleaned up when the authenticated user changes.
          window.__volumeProfileUnsubscribe =
            unsubscribeProfile;
        }
      );

    return () => {

      unsubscribe();

      if (
        window.__volumeProfileUnsubscribe
      ) {

        window.__volumeProfileUnsubscribe();

        window.__volumeProfileUnsubscribe =
          null;
      }
    };

  }, []);


  // ==========================================================
  // EMPLOYEES
  // ==========================================================

  useEffect(() => {

    if (!user) {
      return;
    }

    setDataLoading(true);

    const employeesQuery =
      query(
        collection(
          db,
          "employees"
        ),
        orderBy("name")
      );

    const unsubscribe =
      onSnapshot(
        employeesQuery,
        (snapshot) => {

          const loaded =
            snapshot.docs.map(
              (document) => ({

                id:
                  document.id,

                name:
  document.data().name || "",

email:
  document.data().email || "",

authUID:
  document.data().authUID || null

              })
            );

          setEmployees(loaded);
          setDataLoading(false);
        },
        (err) => {

          console.error(
            "Employees error:",
            err
          );

          setError(
            "Could not load employees."
          );

          setDataLoading(false);
        }
      );

    return () => unsubscribe();

  }, [user]);


  // ==========================================================
  // SHIFTS
  // ==========================================================

  useEffect(() => {

    if (!user) {
      return;
    }

    const shiftsQuery =
      query(
        collection(
          db,
          "shifts"
        ),
        orderBy("date")
      );

    const unsubscribe =
      onSnapshot(
        shiftsQuery,
        (snapshot) => {

          const loaded =
            snapshot.docs.map(
              (document) => {

                const data =
                  document.data();

                return {

                  id:
                    document.id,

                  employeeID:
                    data.employeeID,

                  date:
                    data.date?.toDate()
                    || new Date(),

                  start:
                    data.start ?? 780,

                  end:
                    data.end ?? 1320,

                  department:
                    data.department
                    || "Bar",
                    departments:

                    data.departments

                    || [data.department || "Bar"]

                };
              }
            );

          setShifts(loaded);
        },
        (err) => {

          console.error(
            "Shifts error:",
            err
          );

          setError(
            "Could not load shifts."
          );
        }
      );

    return () => unsubscribe();

  }, [user]);

  // ==========================================================
// REQUESTS
// ==========================================================

useEffect(() => {

  if (!user || !profile) {
    return;
  }

  let unsubscribe;

  if (profile.role === "manager") {

    const requestsQuery =
      query(
        collection(
          db,
          "requests"
        ),
        orderBy(
          "createdAt",
          "desc"
        )
      );

    unsubscribe =
      onSnapshot(
        requestsQuery,
        (snapshot) => {

          const loaded =
            snapshot.docs.map(
              (document) => {

                const data =
                  document.data();

                return {

                  id:
                    document.id,

                  employeeID:
                    data.employeeID,

                  type:
                    data.type || "Day Off",

                  shiftID:
                    data.shiftID || null,

                  requestedDate:
                    data.requestedDate?.toDate()
                    || null,

                  proposedStart:
                    data.proposedStart
                    ?? null,

                  proposedEnd:
                    data.proposedEnd
                    ?? null,

                  replacementEmployeeID:
                    data.replacementEmployeeID
                    || null,

                  replacementShiftID:
                    data.replacementShiftID
                    || null,

                  reason:
                    data.reason || "",

                  status:
                    data.status || "pending",

                  createdAt:
                    data.createdAt?.toDate()
                    || new Date(),

                  reviewedAt:
                    data.reviewedAt?.toDate()
                    || null,

                  managerComment:
                    data.managerComment
                    || ""

                };
              }
            );

          setRequests(loaded);
        },
        (err) => {

          console.error(
            "Manager requests error:",
            err
          );

          setError(
            "Could not load requests."
          );
        }
      );

  } else {

    const requestsQuery =
      query(
        collection(
          db,
          "requests"
        ),
        where(
          "employeeID",
          "==",
          user.uid
        )
      );

    unsubscribe =
      onSnapshot(
        requestsQuery,
        (snapshot) => {

          const loaded =
            snapshot.docs
              .map(
                (document) => {

                  const data =
                    document.data();

                  return {

                    id:
                      document.id,

                    employeeID:
                      data.employeeID,

                    type:
                      data.type || "Day Off",

                    shiftID:
                      data.shiftID || null,

                    requestedDate:
                      data.requestedDate?.toDate()
                      || null,

                    proposedStart:
                      data.proposedStart
                      ?? null,

                    proposedEnd:
                      data.proposedEnd
                      ?? null,

                    replacementEmployeeID:
                      data.replacementEmployeeID
                      || null,

                    replacementShiftID:
                      data.replacementShiftID
                      || null,

                    reason:
                      data.reason || "",

                    status:
                      data.status || "pending",

                    createdAt:
                      data.createdAt?.toDate()
                      || new Date(),

                    reviewedAt:
                      data.reviewedAt?.toDate()
                      || null,

                    managerComment:
                      data.managerComment
                      || ""

                  };
                }
              )
              .sort(
                (a, b) =>
                  b.createdAt -
                  a.createdAt
              );

          setRequests(loaded);
        },
        (err) => {

          console.error(
            "Employee requests error:",
            err
          );

          setError(
            "Could not load your requests."
          );
        }
      );
  }

  return () => {

    if (unsubscribe) {
      unsubscribe();
    }
  };

}, [user, profile]);
useEffect(() => {

  if (!user) {
    setNotifications([]);
    return;
  }

  const notificationsQuery =
    query(
      collection(db, "notifications"),
      orderBy("createdAt", "desc")
    );

  const unsubscribe =
    onSnapshot(
      notificationsQuery,
      (snapshot) => {

        const notificationList =
          snapshot.docs.map(
            (document) => {

              const data =
                document.data();

              return {
                id: document.id,
                type:
                  data.type || "",
                title:
                  data.title || "",
                message:
                  data.message || "",
                publicationID:
                  data.publicationID || null,
                read:
                  data.read || false,
                createdAt:
                  data.createdAt || null
              };
            }
          );

        setNotifications(
          notificationList
        );
      },
      (error) => {

        console.error(
          "Notifications listener error:",
          error
        );
      }
    );

  return () => unsubscribe();

}, [user]);


  // ==========================================================
  // MONTH DATES
  // ==========================================================

  const monthDates = useMemo(() => {

    const year =
      month.getFullYear();

    const monthNumber =
      month.getMonth();

    const days =
      new Date(
        year,
        monthNumber + 1,
        0
      ).getDate();

    return Array.from(
      { length: days },
      (_, index) =>
        new Date(
          year,
          monthNumber,
          index + 1
        )
    );

  }, [month]);


  // ==========================================================
  // LOGIN
  // ==========================================================

  async function handleLogin(event) {

    event.preventDefault();

    const cleanEmail =
      email.trim();

    if (
      !cleanEmail ||
      !password
    ) {
      return;
    }

    setSigningIn(true);
    setError("");

    try {

      await signInWithEmailAndPassword(
        auth,
        cleanEmail,
        password
      );

    } catch (err) {

      console.error(err);

      if (
        err.code ===
        "auth/invalid-credential"
      ) {

        setError(
          "Incorrect email or password."
        );

      } else if (
        err.code ===
        "auth/invalid-email"
      ) {

        setError(
          "Please enter a valid email address."
        );

      } else {

        setError(
          "Could not sign in."
        );
      }

    } finally {

      setSigningIn(false);
    }
  }


  // ==========================================================
  // SIGN OUT
  // ==========================================================

  async function handleSignOut() {

    try {

      await signOut(auth);

      setActiveTab("timetable");

    } catch (err) {

      console.error(err);
    }
  }


  // ==========================================================
  // SHIFT EDITOR
  // ==========================================================

 function openAddShift(date, department = "Bar") {
  setSelectedShift(null);
  setEditorDate(date);
  setEditorDepartment(department);
  setShowEditor(true);
}


  function openEditShift(shift) {

    setSelectedShift(shift);
    setEditorDate(shift.date);
    setShowEditor(true);
  }


  // ==========================================================
  // SAVE SHIFT
  // ==========================================================

  async function saveShift({
    employeeID,
    date,
    start,
    end,
    department,
    departments
  }) {

    if (!employeeID) {
      return;
    }

    const id =
      selectedShift?.id ||
      crypto.randomUUID();

    try {

      await setDoc(
        doc(
          db,
          "shifts",
          id
        ),
        {

          employeeID,

          date:
            Timestamp.fromDate(
              startOfDay(date)
            ),

          start,

          end,

          department,
          departments:

            departments?.length

              ? departments

              : [department],

          updatedAt:
            serverTimestamp()

        },
        {
          merge: true
        }
      );

      setShowEditor(false);
      setSelectedShift(null);

    } catch (err) {

      console.error(err);

      setError(
        "Could not save shift."
      );
    }
  }


  // ==========================================================
  // DELETE SHIFT
  // ==========================================================

  async function deleteShift(shift) {

    const confirmed =
      window.confirm(
        "Delete this shift?"
      );

    if (!confirmed) {
      return;
    }

    try {

      await deleteDoc(
        doc(
          db,
          "shifts",
          shift.id
        )
      );

      setShowEditor(false);
      setSelectedShift(null);

    } catch (err) {

      console.error(err);

      setError(
        "Could not delete shift."
      );
    }
  }

  // ==========================================================
// CREATE REQUEST
// ==========================================================
async function createDayOffRequest({
  shift,
  requestType,
  newStart,
  newEnd,
  swapEmployeeID,
  swapShiftID,
  reason
}) {

  if (!user || !shift) {
    return;
  }

  try {

    // -------------------------------------------------------
    // Prevent duplicate pending requests
    // -------------------------------------------------------

    const existingRequestsSnapshot =
      await new Promise(
        (resolve, reject) => {

          const unsubscribe =
            onSnapshot(
              query(
                collection(
                  db,
                  "requests"
                ),
                where(
                  "employeeID",
                  "==",
                  user.uid
                ),
                where(
                  "status",
                  "==",
                  "pending"
                )
              ),
              (snapshot) => {

                unsubscribe();

                resolve(snapshot);
              },
              (error) => {

                unsubscribe();

                reject(error);
              }
            );
        }
      );

    const duplicateRequest =
      existingRequestsSnapshot.docs.some(
        (document) => {

          const data =
            document.data();

          // Same shift + same request type
          if (
            data.shiftID === shift.id &&
            data.type === requestType
          ) {

            // For Shift Swap, also require
            // the same employee and replacement shift.
            if (
              requestType === "Shift Swap"
            ) {

              return (
                data.replacementEmployeeID ===
                  swapEmployeeID &&
                data.replacementShiftID ===
                  swapShiftID
              );

            }

            return true;
          }

          return false;
        }
      );

    if (duplicateRequest) {

      setError(
        "You already have a pending request for this shift."
      );

      return;
    }

    const requestID =
      crypto.randomUUID();

    await setDoc(
      doc(
        db,
        "requests",
        requestID
      ),
      {

        employeeID:
          user.uid,

        type:
          requestType,

        shiftID:
          shift.id,

        requestedDate:
          Timestamp.fromDate(
            startOfDay(
              shift.date
            )
          ),

        proposedStart:
  requestType === "Shift Change"
    ? newStart
    : shift.start,

proposedEnd:
  requestType === "Shift Change"
    ? newEnd
    : shift.end,

        reason:
          reason.trim(),


          replacementEmployeeID:
  requestType === "Shift Swap"
    ? swapEmployeeID
    : null,

replacementShiftID:
  requestType === "Shift Swap"
    ? swapShiftID
    : null,

reason:
  reason.trim(),

        status:
          "pending",

        createdAt:
          serverTimestamp()

      }
    );

  } catch (err) {

    console.error(
      "Errore di richiesta di creazione:",
      err
    );

    setError(
      "Impossibile inviare la richiesta."
    );

    throw err;
  }
}

// ==========================================================
// APPROVE REQUEST
// ==========================================================

async function approveRequest(
  request,
  managerComment = ""
) {

  if (!isManagerProfile(profile)) {
    return;
  }

  if (
    request.status !==
    "pending"
  ) {
    return;
  }

  try {

    // -------------------------------------------------------
    // Find the timetable employee.
    //
    // Existing employee documents currently use UUIDs while
    // requests use Firebase Auth UIDs, so for now we match
    // the employee name from /users to /employees.
    // -------------------------------------------------------

    const userProfileSnapshot =
      await new Promise(
        (resolve, reject) => {

          const unsubscribe =
            onSnapshot(
              doc(
                db,
                "users",
                request.employeeID
              ),
              (snapshot) => {

                unsubscribe();

                resolve(snapshot);
              },
              (error) => {

                unsubscribe();

                reject(error);
              }
            );
        }
      );

    const employeeName =
      userProfileSnapshot.data()
        ?.name
        ?.trim()
        ?.toLowerCase();

    if (!employeeName) {

      throw new Error(
        "Employee profile not found."
      );
    }

    const timetableEmployee =
  employees.find(
    (employee) =>
      employee.authUID ===
      request.employeeID
  );

    if (!timetableEmployee) {

      throw new Error(
  "Could not find this employee in the timetable."
);
    }


    // -------------------------------------------------------
    // DAY OFF
    // -------------------------------------------------------

   if (request.type === "Day Off") {

  if (request.shiftID) {

    await deleteDoc(
      doc(
        db,
        "shifts",
        request.shiftID
      )
    );

  } else if (request.requestedDate) {

    const matchingShifts =
      shifts.filter(
        (shift) =>
          shift.employeeID ===
            timetableEmployee.id &&
          sameDay(
            shift.date,
            request.requestedDate
          )
      );

    await Promise.all(
      matchingShifts.map(
        (shift) =>
          deleteDoc(
            doc(
              db,
              "shifts",
              shift.id
            )
          )
      )
    );
  }
}

// -------------------------------------------------------
// SHIFT CHANGE
// -------------------------------------------------------

if (request.type === "Shift Change") {

  if (
    !request.shiftID ||
    request.proposedStart === null ||
    request.proposedEnd === null
  ) {
    throw new Error(
      "La richiesta di modifica del turno è un turno mancante o un orario richiesto."
    );
  }

  await updateDoc(
    doc(
      db,
      "shifts",
      request.shiftID
    ),
    {
      start:
        request.proposedStart,

      end:
        request.proposedEnd,

      updatedAt:
        serverTimestamp()
    }
  );
}


// -------------------------------------------------------
// SHIFT SWAP
// -------------------------------------------------------

if (request.type === "Shift Swap") {

  if (
    !request.shiftID ||
    !request.replacementShiftID
  ) {
    throw new Error(
      "Alla richiesta Shift Swap manca uno dei turni."
    );
  }

  const requestedShift =
    shifts.find(
      (shift) =>
        shift.id === request.shiftID
    );

  const replacementShift =
    shifts.find(
      (shift) =>
        shift.id === request.replacementShiftID
    );

  if (!requestedShift || !replacementShift) {
    throw new Error(
      "Uno dei turni in questo scambio non può essere trovato."
    );
  }

  await updateDoc(
    doc(
      db,
      "shifts",
      request.shiftID
    ),
    {
      employeeID:
        replacementShift.employeeID,

      updatedAt:
        serverTimestamp()
    }
  );

  await updateDoc(
    doc(
      db,
      "shifts",
      request.replacementShiftID
    ),
    {
      employeeID:
        requestedShift.employeeID,

      updatedAt:
        serverTimestamp()
    }
  );
}



    // -------------------------------------------------------
    // APPROVE REQUEST
    // -------------------------------------------------------

    const cleanComment =
      managerComment.trim();

    const updateData = {

      status:
        "approvato",

      reviewedAt:
        serverTimestamp()

    };

    if (cleanComment) {

      updateData.managerComment =
        cleanComment;
    }

    await updateDoc(
      doc(
        db,
        "requests",
        request.id
      ),
      updateData
    );

  } catch (err) {

    console.error(
      "Approve request error:",
      err
    );

    setError(
      err.message ||
      "Could not approve request."
    );

    throw err;
  }
}

// ==========================================================
// REJECT REQUEST
// ==========================================================

async function rejectRequest(
  request,
  managerComment = ""
) {

  if (!isManagerProfile(profile)) {
    return;
  }

  if (
    request.status !==
    "pending"
  ) {
    return;
  }

  try {

    const cleanComment =
      managerComment.trim();

    const updateData = {

      status:
        "rejected",

      reviewedAt:
        serverTimestamp()

    };

    if (cleanComment) {

      updateData.managerComment =
        cleanComment;
    }

    await updateDoc(
      doc(
        db,
        "requests",
        request.id
      ),
      updateData
    );

  } catch (err) {

    console.error(
      "Reject request error:",
      err
    );

    setError(
      "Could not reject request."
    );

    throw err;
  }
}


  // ==========================================================
  // ADD EMPLOYEE
  // ==========================================================

  async function addEmployee() {

    const cleanName =
  newEmployeeName.trim();

const cleanEmail =
  newEmployeeEmail.trim();

if (!cleanName || !cleanEmail) {
  return;
}

    try {

      const id =
        crypto.randomUUID();

      await setDoc(
        doc(
          db,
          "employees",
          id
        ),
        {
  name:
    cleanName,

  email:
    cleanEmail,

  createdAt:
    serverTimestamp()
}
      );

      setNewEmployeeName("");
setNewEmployeeEmail("");
setShowAddEmployee(false);

    } catch (err) {

      console.error(err);

      setError(
        "Could not add employee."
      );
    }
  }


  // ==========================================================
  // DELETE EMPLOYEE
  // ==========================================================

  async function deleteEmployee(employee) {

    const employeeShifts =
      shifts.filter(
        (shift) =>
          shift.employeeID ===
          employee.id
      );

    let message =
      `Delete ${employee.name}?`;

    if (
      employeeShifts.length > 0
    ) {

      message +=
        `\n\nThis employee has ${employeeShifts.length} shift${
          employeeShifts.length === 1
            ? ""
            : "s"
        }. Those shifts will also be deleted.`;
    }

    const confirmed =
      window.confirm(message);

    if (!confirmed) {
      return;
    }

    try {

      // Delete employee
      await deleteDoc(
        doc(
          db,
          "employees",
          employee.id
        )
      );

      // Delete all their shifts
      await Promise.all(
        employeeShifts.map(
          (shift) =>
            deleteDoc(
              doc(
                db,
                "shifts",
                shift.id
              )
            )
        )
      );

    } catch (err) {

      console.error(err);

      setError(
        "Could not delete employee."
      );
    }
  }


  // ==========================================================
  // LOADING
  // ==========================================================

  if (loading) {

    return (
      <div className="loading-screen">

        <div className="volume-logo">
          VOLUME
        </div>

        <div className="spinner" />

        <p>
          Connecting...
        </p>

      </div>
    );
  }


  // ==========================================================
  // LOGIN
  // ==========================================================

  if (!user) {

    return (
      <div className="login-screen">

        <div className="login-brand">

          <h1>
            VOLUME
          </h1>

          <p>
            Orrario
          </p>

        </div>

        <form
          className="login-card"
          onSubmit={handleLogin}
        >

          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(event) =>
              setEmail(
                event.target.value
              )
            }
            autoComplete="email"
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(event) =>
              setPassword(
                event.target.value
              )
            }
            autoComplete="current-password"
          />

          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={
              signingIn ||
              !email.trim() ||
              !password
            }
          >
            {signingIn
              ? "Signing in..."
              : "Sign In"}
          </button>

        </form>

        <p className="private-text">
          Private employee timetable
        </p>

      </div>
    );
  }


  const isManager =
    profile?.role === "manager";


  // ==========================================================
  // MAIN APP
  // ==========================================================

  return (
    <div className="app-shell">

      {/* TOP BAR */}

      <header className="top-bar">

        <div className="brand">

          <strong>
            VOLUME
          </strong>

          <span>
            Orrario
          </span>

        </div>

        <div className="user-area">
          <button
  onClick={enablePushNotifications}
>
  🔔 Attiva notifiche
</button>

          <span>
            {profile?.name ||
              user.email}
          </span>

          <span
            className={
              isManager
                ? "role manager"
                : "role"
            }
          >
            {isManager
              ? "MANAGER"
              : "EMPLOYEE"}
          </span>

          <button
            onClick={handleSignOut}
          >
            Esci
          </button>

        </div>

      </header>


      {/* NAVIGATION */}

      <nav className="main-navigation">

        <button
          className={
            activeTab === "timetable"
              ? "nav-button active"
              : "nav-button"
          }
          onClick={() =>
            setActiveTab(
              "timetable"
            )
          }
        >
          📅 Turni
        </button>

        <button
          className={
            activeTab === "employees"
              ? "nav-button active"
              : "nav-button"
          }
          onClick={() =>
            setActiveTab(
              "employees"
            )
          }
        >
          👥 Dipendenti
        </button>

        <button
          className={
            activeTab === "hours"
              ? "nav-button active"
              : "nav-button"
          }
          onClick={() =>
            setActiveTab("hours")
          }
        >
          ⏱ Ore
        </button>

        <button
          className={
            activeTab === "requests"
              ? "nav-button active"
              : "nav-button"
          }
          onClick={() =>
            setActiveTab(
              "requests"
            )
          }
        >
          🔄 Richieste
        </button>
        <button
  className={
    activeTab === "notifications"
      ? "nav-button active"
      : "nav-button"
  }
  onClick={() =>
    setActiveTab(
      "notifications"
    )
  }
>
  🔔 Notifiche
</button>

      </nav>


      {/* CONTENT */}

      {activeTab === "timetable" && (

        <TimetableView
          month={month}
          setMonth={setMonth}
          monthDates={monthDates}
          employees={employees}
          shifts={shifts}
          isManager={isManager}
          dataLoading={dataLoading}
          profile={profile}
          openAddShift={openAddShift}
          openEditShift={openEditShift}
        />

      )}


      {activeTab === "employees" && (

        <EmployeesView
          employees={employees}
          shifts={shifts}
          isManager={isManager}
          showAddEmployee={
            showAddEmployee
          }
          setShowAddEmployee={
            setShowAddEmployee
          }
          newEmployeeName={
            newEmployeeName
          }
          setNewEmployeeName={
            setNewEmployeeName
          }
          newEmployeeEmail={
  newEmployeeEmail
}
setNewEmployeeEmail={
  setNewEmployeeEmail
}
          addEmployee={
            addEmployee
          }
          deleteEmployee={
            deleteEmployee
          }
        />

      )}


      {activeTab === "hours" && (

        <HoursView
          month={month}
          setMonth={setMonth}
          employees={employees}
          shifts={shifts}
        />

      )}


      {activeTab === "requests" && (

 <RequestsView
  isManager={isManager}
  profile={profile}
  user={user}
  requests={requests}
  employees={employees}
  shifts={shifts}
    onCreateDayOff={
      createDayOffRequest
    }
    onApprove={
      approveRequest
    }
    onReject={
      rejectRequest
    }
  />

)}
{activeTab === "notifications" && (

  <NotificationsView
    notifications={notifications}
  />

)}


      {/* SHIFT EDITOR */}

      {showEditor && (

 <ShiftEditor

  key={`${selectedShift?.id || "new"}-${editorDate.getTime()}-${editorDepartment}`}

  shift={selectedShift}

  date={editorDate}

  defaultDepartment={editorDepartment}

  employees={employees}

          onClose={() => {

            setShowEditor(false);
            setSelectedShift(null);

          }}
          onSave={saveShift}
          onDelete={deleteShift}
        />

      )}

    </div>
  );
}
// ============================================================
// MANAGER DEPARTMENT WEEKLY TIMETABLE
// ============================================================

function ManagerDepartmentTimetable({
  shifts,
  employees,
  openAddShift,
  openEditShift,
  isManager = true
}) {

  const departments = [
  "Bar",
  "Sala",
  "Piattini",
  "Preparazione/Ricevimento"
];

  const [weekDate, setWeekDate] =
    useState(new Date());

    const [showPublishModal, setShowPublishModal] =
  useState(false);
  const [publishPeriod, setPublishPeriod] =
  useState("this-week");
  const [showShareModal, setShowShareModal] =
  useState(false);

const [sharePeriod, setSharePeriod] =
  useState("this-week");

const [shareFormat, setShareFormat] =
  useState("png");

const [isGeneratingExport, setIsGeneratingExport] =
  useState(false);
 async function publishTimetable() {

  try {

    let publicationStart;
    let publicationEnd;

    if (publishPeriod === "this-week") {

      publicationStart =
        new Date(weekDates[0]);

      publicationEnd =
        new Date(weekDates[6]);

    } else if (publishPeriod === "next-week") {

      publicationStart =
        new Date(weekDates[0]);

      publicationStart.setDate(
        publicationStart.getDate() + 7
      );

      publicationEnd =
        new Date(publicationStart);

      publicationEnd.setDate(
        publicationEnd.getDate() + 6
      );

    } else if (publishPeriod === "two-weeks") {

      publicationStart =
        new Date(weekDates[0]);

      publicationEnd =
        new Date(weekDates[0]);

      publicationEnd.setDate(
        publicationEnd.getDate() + 13
      );

    } else if (publishPeriod === "this-month") {

      publicationStart =
        new Date(
          weekDate.getFullYear(),
          weekDate.getMonth(),
          1
        );

      publicationEnd =
        new Date(
          weekDate.getFullYear(),
          weekDate.getMonth() + 1,
          0
        );

    }

    publicationStart.setHours(
      0, 0, 0, 0
    );

    publicationEnd.setHours(
      23, 59, 59, 999
    );
    const periodText =
  publicationStart.toLocaleDateString(
    "it-IT",
    {
      month: "long",
      day: "numeric",
      year: "numeric"
    }
  ) +
  "–" +
  publicationEnd.toLocaleDateString(
    "it-IT",
    {
      month: "long",
      day: "numeric",
      year: "numeric"
    }
  );

const publicationRef = await addDoc(collection(db, "publications"), {
  type: publishPeriod,
  startDate: Timestamp.fromDate(publicationStart),
  endDate: Timestamp.fromDate(publicationEnd),
  createdAt: serverTimestamp(),
  pushStatus: "pending"
});


await addDoc(
  collection(db, "notifications"),
  {
    type: "timetable_published",

    title:
      "Orario pubblicato",

    message:
  `Il calendario per ${periodText} è ora disponibile.`,

    publicationID:
      publicationRef.id,

    createdAt:
      serverTimestamp(),

    read: false
  }
);

    setShowPublishModal(false);

    alert("Orario pubblicato");

  } catch (error) {

    console.error(
      "Errore di pubblicazione dell'orario:",
      error
    );

    alert(
      `Publish error: ${error.message}`
    );
  }
}
function shareTimetableOnWhatsApp() {
  setShowShareModal(true);
}

    function getExportPeriod(period) {
    let start;
    let end;

    if (period === "this-week") {
      start = new Date(weekDates[0]);
      end = new Date(weekDates[6]);
    } else if (period === "next-week") {
      start = new Date(weekDates[0]);
      start.setDate(start.getDate() + 7);

      end = new Date(start);
      end.setDate(end.getDate() + 6);
    } else if (period === "two-weeks") {
      start = new Date(weekDates[0]);
      end = new Date(start);
      end.setDate(end.getDate() + 13);
    } else {
      start = new Date(
        weekDate.getFullYear(),
        weekDate.getMonth(),
        1
      );

      end = new Date(
        weekDate.getFullYear(),
        weekDate.getMonth() + 1,
        0
      );
    }

    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    return { start, end };
  }
  function splitIntoWeeks(start, end) {
  const weeks = [];
  let current = new Date(start);

  while (current <= end) {
    const weekStart = new Date(current);
    const weekEnd = new Date(current);

    weekEnd.setDate(weekEnd.getDate() + 6);

    if (weekEnd > end) {
      weekEnd.setTime(end.getTime());
    }

    weeks.push({
      start: weekStart,
      end: weekEnd
    });

    current = new Date(weekEnd);
    current.setDate(current.getDate() + 1);
    current.setHours(0, 0, 0, 0);
  }

  return weeks;
}

    async function generateTimetableExport() {
    setIsGeneratingExport(true);

    let exportElements = [];

    try {
      const { start, end } = getExportPeriod(sharePeriod);
      const weeks = splitIntoWeeks(start, end);

      const monthName = start.toLocaleDateString("it-IT", {
        month: "long",
        year: "numeric"
      });

      const filePrefix =
        `VOLUME-orario-${start.toISOString().slice(0, 10)}`;

      // Build one readable timetable for each weekly section.
      for (let weekIndex = 0; weekIndex < weeks.length; weekIndex++) {
        const week = weeks[weekIndex];
        const dates = [];
        const current = new Date(week.start);

        while (current <= week.end) {
          dates.push(new Date(current));
          current.setDate(current.getDate() + 1);
        }

        const periodLabel =
          `${week.start.toLocaleDateString("it-IT")} – ` +
          `${week.end.toLocaleDateString("it-IT")}`;

        const element = document.createElement("div");

        Object.assign(element.style, {
          position: "fixed",
          left: "-10000px",
          top: "0",
          width: "1200px",
          padding: "32px",
          background: "#ffffff",
          color: "#172033",
          fontFamily: "Arial, sans-serif",
          boxSizing: "border-box"
        });

        const heading = document.createElement("div");

        heading.innerHTML = `
          <div style="font-size:32px;font-weight:800;letter-spacing:3px;color:#173b75">
            VOLUME
          </div>
          <div style="font-size:22px;font-weight:700;margin-top:8px">
            ORARIO DEL PERSONALE
          </div>
          <div style="font-size:15px;color:#64748b;margin-top:8px">
            ${periodLabel}
          </div>
          ${
            weeks.length > 1
              ? `<div style="font-size:13px;color:#64748b;margin-top:5px">
                   ${monthName} · Settimana ${weekIndex + 1} di ${weeks.length}
                 </div>`
              : ""
          }
        `;

        element.appendChild(heading);

        const table = document.createElement("table");

        Object.assign(table.style, {
          width: "100%",
          borderCollapse: "collapse",
          tableLayout: "fixed",
          marginTop: "28px",
          fontSize: "13px"
        });

        const header = document.createElement("tr");
        const departmentHeader = document.createElement("th");

        departmentHeader.textContent = "DIPARTIMENTO";

        Object.assign(departmentHeader.style, {
          width: "180px",
          background: "#173b75",
          color: "#ffffff",
          padding: "12px 8px",
          textAlign: "left",
          border: "1px solid #dbe3ef"
        });

        header.appendChild(departmentHeader);

        dates.forEach((date) => {
          const th = document.createElement("th");

          th.textContent = date.toLocaleDateString("it-IT", {
            weekday: "short",
            day: "2-digit",
            month: "2-digit"
          });

          Object.assign(th.style, {
            background: "#173b75",
            color: "#ffffff",
            padding: "10px 4px",
            border: "1px solid #dbe3ef",
            overflowWrap: "anywhere"
          });

          header.appendChild(th);
        });

        table.appendChild(header);

        departments.forEach((department) => {
          const row = document.createElement("tr");
          const departmentCell = document.createElement("th");

          departmentCell.textContent = department;

          Object.assign(departmentCell.style, {
            background: "#eef3fb",
            color: "#173b75",
            textAlign: "left",
            verticalAlign: "top",
            padding: "12px 8px",
            border: "1px solid #dbe3ef",
            overflowWrap: "anywhere"
          });

          row.appendChild(departmentCell);

          dates.forEach((date) => {
            const cell = document.createElement("td");

            Object.assign(cell.style, {
              verticalAlign: "top",
              padding: "6px",
              border: "1px solid #dbe3ef",
              overflowWrap: "anywhere"
            });

            const dayShifts = shifts
              .filter((shift) =>
                (
                  shift.department === department ||
                  shift.departments?.includes(department)
                ) &&
                sameDay(shift.date, date)
              )
              .sort((a, b) => a.start - b.start);

            dayShifts.forEach((shift) => {
              const card = document.createElement("div");

              Object.assign(card.style, {
                background: "#f5f8fd",
                border: "1px solid #dbe3ef",
                borderRadius: "6px",
                padding: "7px",
                marginBottom: "6px",
                lineHeight: "1.45",
                overflowWrap: "anywhere"
              });

              const name = document.createElement("div");
              name.textContent = employeeName(shift.employeeID);

              Object.assign(name.style, {
                fontWeight: "700",
                color: "#173b75",
                marginBottom: "3px"
              });

              const time = document.createElement("div");

              time.textContent =
                `${minutesToTime(shift.start)}–` +
                `${minutesToTime(shift.end)}` +
                (shift.end <= shift.start ? " (+1)" : "");

              card.appendChild(name);
              card.appendChild(time);
              cell.appendChild(card);
            });

            if (dayShifts.length === 0) {
              cell.textContent = "—";
              cell.style.color = "#94a3b8";
              cell.style.textAlign = "center";
            }

            row.appendChild(cell);
          });

          table.appendChild(row);
        });

        element.appendChild(table);
        document.body.appendChild(element);
        exportElements.push(element);
      }

      // Convert each weekly section into a canvas.
      const canvases = [];

      for (const element of exportElements) {
        const canvas = await html2canvas(element, {
  backgroundColor: "#ffffff",
  scale: 1.5,
  logging: false
});

        canvases.push(canvas);
      }

      if (shareFormat === "pdf") {
        // A multi-week PDF gets one landscape page per week.
        const pdf = new jsPDF({
          orientation: "landscape",
          unit: "mm",
          format: "a3"
        });

        for (let index = 0; index < canvases.length; index++) {
          if (index > 0) {
            pdf.addPage("a3", "landscape");
          }

          const canvas = canvases[index];
          const image = canvas.toDataURL("image/jpeg", 0.82);
          const pageWidth = pdf.internal.pageSize.getWidth();
          const pageHeight = pdf.internal.pageSize.getHeight();

          const ratio = Math.min(
            pageWidth / canvas.width,
            pageHeight / canvas.height
          );

          const width = canvas.width * ratio;
          const height = canvas.height * ratio;

          pdf.addImage(
            image,
            "PNG",
            (pageWidth - width) / 2,
            (pageHeight - height) / 2,
            width,
            height
          );
        }

        const blob = pdf.output("blob");

        await shareOrDownloadFile(
          blob,
          `${filePrefix}.pdf`,
          "application/pdf",
          `${start.toLocaleDateString("it-IT")} – ${end.toLocaleDateString("it-IT")}`
        );
      } else if (canvases.length === 1) {
        // Preserve the current single-week PNG experience.
        const blob = await new Promise((resolve, reject) => {
          canvases[0].toBlob((result) => {
            if (result) {
              resolve(result);
            } else {
              reject(new Error("Impossibile creare l'immagine."));
            }
          }, "image/png");
        });

        await shareOrDownloadFile(
          blob,
          `${filePrefix}.png`,
          "image/png",
          `${start.toLocaleDateString("it-IT")} – ${end.toLocaleDateString("it-IT")}`
        );
      } else {
        // Longer PNG exports are downloaded individually, one per week.
        for (let index = 0; index < canvases.length; index++) {
          const blob = await new Promise((resolve, reject) => {
            canvases[index].toBlob((result) => {
              if (result) {
                resolve(result);
              } else {
                reject(new Error("Impossibile creare l'immagine."));
              }
            }, "image/png");
          });

          const week = weeks[index];
          const weeklyFileName =
            `${filePrefix}-settimana-${index + 1}.png`;

          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");

          link.href = url;
          link.download = weeklyFileName;
          document.body.appendChild(link);
          link.click();
          link.remove();

          window.setTimeout(() => URL.revokeObjectURL(url), 60000);
        }

        alert(
          `Sono state generate ${canvases.length} immagini PNG, una per settimana. ` +
          "Controlla la cartella Download."
        );
      }
    } catch (error) {
      console.error("Errore nella creazione dell'orario:", error);
      alert(`Impossibile generare il file: ${error.message}`);
    } finally {
      exportElements.forEach((element) => element.remove());
      setIsGeneratingExport(false);
    }
  }

  async function shareOrDownloadFile(blob, fileName, mimeType, periodLabel) {
    const file = new File([blob], fileName, {
      type: mimeType
    });

    const message =
      `📅 VOLUME – Orario del personale\n${periodLabel}\n` +
      "Orario aggiornato.";

    if (
      navigator.canShare &&
      navigator.canShare({ files: [file] }) &&
      navigator.share
    ) {
      try {
        await navigator.share({
          title: "VOLUME – Orario del personale",
          text: message,
          files: [file]
        });

        return;
      } catch (error) {
        if (error.name === "AbortError") {
          return;
        }

        console.warn("Condivisione diretta non disponibile:", error);
      }
    }

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();

    window.open(
      `https://wa.me/?text=${encodeURIComponent(
        `${message}\n\nhttps://danyalrahujo.github.io/volume-pwa/`
      )}`,
      "_blank",
      "noopener,noreferrer"
    );

    window.setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  function getMonday(date) {

    const result =
      new Date(date);

    const day =
      result.getDay();

    const difference =
      day === 0
        ? -6
        : 1 - day;

    result.setDate(
      result.getDate() + difference
    );

    result.setHours(
      0,
      0,
      0,
      0
    );

    return result;
  }

  const weekStart =
    getMonday(weekDate);

  const weekDates =
    Array.from(
      { length: 7 },
      (_, index) => {

        const date =
          new Date(weekStart);

        date.setDate(
          weekStart.getDate() + index
        );

        return date;
      }
    );

  function goPreviousWeek() {

    setWeekDate(
      new Date(
        weekDate.getFullYear(),
        weekDate.getMonth(),
        weekDate.getDate() - 7
      )
    );
  }

  function goNextWeek() {

    setWeekDate(
      new Date(
        weekDate.getFullYear(),
        weekDate.getMonth(),
        weekDate.getDate() + 7
      )
    );
  }

  function goToday() {
    setWeekDate(new Date());
  }

  function employeeName(employeeID) {

    const employee =
      employees.find(
        (item) =>
          item.id === employeeID
      );

    return employee?.name || "Employee";
  }

  function formatWeekTitle() {

    const first =
      weekDates[0];

    const last =
      weekDates[6];

    const firstMonth =
      first.toLocaleDateString(
        "it-IT",
        {
          month: "long"
        }
      );

    const lastMonth =
      last.toLocaleDateString(
        "it-IT",
        {
          month: "long"
        }
      );

    if (
      first.getMonth() ===
      last.getMonth()
    ) {

      return `${firstMonth} ${first.getDate()}–${last.getDate()}, ${last.getFullYear()}`;

    }

    return `${firstMonth} ${first.getDate()} – ${lastMonth} ${last.getDate()}, ${last.getFullYear()}`;
  }

  return (
    <main className="main-content">

      <div className="page-header">

        <div>

          <h1>
            Orario
          </h1>

          <p>
            Gestisci i turni per dipartimento
          </p>

        </div>

      </div>


      {/* WEEK NAVIGATION */}

      <div className="month-navigation">

        <button
          onClick={goPreviousWeek}
        >
          ‹
        </button>

        <strong>
          {formatWeekTitle()}
        </strong>

        <button
          onClick={goNextWeek}
        >
          ›
        </button>

        <button
          className="today-button"
          onClick={goToday}
        >
          Oggi
        </button>

      </div>


      {/* DEPARTMENT TABLE */}

      <div className="table-wrapper">

        <div className="timetable">

          {/* HEADER */}

          <div className="table-row table-header">

            <div className="employee-column">
              DIPARTIMENTO
            </div>

            {weekDates.map(
              (date) => (

                <div
                  className={
                    sameDay(
                      date,
                      new Date()
                    )
                      ? "day-column today"
                      : "day-column"
                  }
                  key={
                    date.toISOString()
                  }
                >

                  <span>
                    {date.toLocaleDateString(
                      "it-IT",
                      {
                        weekday:
                          "short"
                      }
                    )}
                  </span>

                  <strong>
                    {date.getDate()}
                  </strong>

                </div>

              )
            )}

          </div>


          {/* DEPARTMENT ROWS */}

          {departments.map(
            (department) => (

              <div
                className="table-row"
                key={department}
              >

                {/* DEPARTMENT NAME */}

                <div className="employee-column employee-name">

                  {department}

                </div>


                {/* DAYS */}

                {weekDates.map(
                  (date) => {

                    const dayShifts =
                      shifts
                        .filter(
                          (shift) =>
  (
    shift.department === department ||
    shift.departments?.includes(department)
  ) &&
  sameDay(
    shift.date,
    date
  )
                        )
                        .sort(
                          (a, b) =>
                            a.start -
                            b.start
                        );

                    return (

                      <div
                        className="day-column shift-cell"
                        key={
                          date.toISOString()
                        }
                      >

                        {dayShifts.length > 0 ? (

                          <div className="shift-list">

                            {dayShifts.map((shift) => (

                              <button
                                key={shift.id}
                                className="shift-card"
                                onClick={() => {
                                  if (isManager) {
                                    openEditShift(shift);
                                  }
                                }}
                                disabled={!isManager}
                              >
                                <strong>
                                  {employeeName(shift.employeeID)}
                                </strong>

                                <span>
                                  {minutesToTime(shift.start)}
                                  {"–"}
                                  {minutesToTime(shift.end)}
                                  {shift.end <= shift.start && " (+1)"}
                                </span>

                                <small>
                                  {durationText(shift.start, shift.end)}
                                </small>
                              </button>

                            ))}

                            {isManager && (
                              <button
                                className="empty-cell"
                                onClick={() =>
                                  openAddShift(date, department)
                                }
                              >
                                +
                              </button>
                            )}

                          </div>

                        ) : (

                          isManager ? (
                            <button
                              className="empty-cell"
                              onClick={() =>
                                openAddShift(date, department)
                              }
                            >
                              +
                            </button>
                          ) : (
                            <span className="dash">—</span>
                          )

                        )}

                      </div>

                    );

                  }
                )}

              </div>

            )
          )}

        </div>

      </div>


     <div className="info-row">

  <span>
    {employees.length} employee
    {employees.length !== 1
      ? "s"
      : ""}
  </span>

  <span>
    Vista settimanale
  </span>

  {isManager && (
  <div className="info-actions">

    <button
      className="publish-button"
      onClick={() =>
        setShowPublishModal(true)
      }
    >
      📢 Pubblica turni
    </button>

    <button
      className="whatsapp-button"
      onClick={shareTimetableOnWhatsApp}
    >
      🟢 Condividi su WhatsApp
    </button>

    <button
      className="add-shift-button"
      onClick={() =>
        openAddShift(
          new Date()
        )
      }
    >
      + Aggiungi turno
    </button>

  </div>
)}

</div>
{showShareModal && (
  <div
    className="modal-backdrop"
    onClick={(event) => {
      if (event.target === event.currentTarget) {
        setShowShareModal(false);
      }
    }}
  >
    <div
      className="modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-modal-title"
    >
      <div className="modal-header">
        <div>
          <h2 id="share-modal-title">
            Condividi orario
          </h2>

          <p>
            Genera un'immagine o un PDF da inviare su WhatsApp.
          </p>
        </div>

        <button
          className="close-button"
          onClick={() => setShowShareModal(false)}
          aria-label="Chiudi"
        >
          ×
        </button>
      </div>

      <div className="form">
        <label>
          Periodo dell'orario

          <select
            value={sharePeriod}
            onChange={(event) =>
              setSharePeriod(event.target.value)
            }
          >
            <option value="this-week">
              Questa settimana
            </option>

            <option value="next-week">
              Prossima settimana
            </option>

            <option value="two-weeks">
              Prossime 2 settimane
            </option>

            <option value="this-month">
              Questo mese
            </option>
          </select>
        </label>

        <label>
          Formato del file

          <select
            value={shareFormat}
            onChange={(event) =>
              setShareFormat(event.target.value)
            }
          >
            <option value="png">
              Immagine PNG
            </option>

            <option value="pdf">
              Documento PDF
            </option>
          </select>
        </label>

        <div className="form-actions">
          <button
            className="secondary-button"
            onClick={() => setShowShareModal(false)}
            disabled={isGeneratingExport}
          >
            Annulla
          </button>

          <button
            className="primary-button"
            onClick={generateTimetableExport}
            disabled={isGeneratingExport}
          >
            {isGeneratingExport
              ? "Generazione in corso..."
              : "Genera e condividi"}
          </button>
        </div>
      </div>
    </div>
  </div>
)}
{showPublishModal && (

  <div className="modal-backdrop">

    <div className="modal">

      <div className="modal-header">

        <div>

          <h2>
            Orario di pubblicazione
          </h2>

          <p>
            Scegli il periodo che desideri pubblicare.
          </p>

        </div>

        <button
          className="close-button"
          onClick={() =>
            setShowPublishModal(false)
          }
        >
          ×
        </button>

      </div>


      <div className="form">

        <label>
          Periodo dell'orario

          <select
  value={publishPeriod}
  onChange={(event) =>
    setPublishPeriod(
      event.target.value
    )
  }
>

            <option value="this-week">
              Questa settimana
            </option>

            <option value="next-week">
              Prossima settimana
            </option>

            <option value="two-weeks">
              Prossime 2 settimane
            </option>

            <option value="this-month">
              Questo mese
            </option>

          </select>

        </label>


        <div className="form-actions">

          <div />

          <div className="right-actions">

            <button
              className="secondary-button"
              onClick={() =>
                setShowPublishModal(false)
              }
            >
              Annulla
            </button>

            <button
  className="primary-button"
  onClick={publishTimetable}
>
  Pubblicare
</button>

          </div>

        </div>

      </div>

    </div>

  </div>

)}

    </main>
  );
}


// ============================================================
// TIMETABLE VIEW
// ============================================================

function TimetableView({
  month,
  setMonth,
  monthDates,
  employees,
  shifts,
  isManager,
  dataLoading,
  profile,
  openAddShift,
  openEditShift
}) {
    
    return (
  <ManagerDepartmentTimetable
    shifts={shifts}
    employees={employees}
    openAddShift={openAddShift}
    openEditShift={openEditShift}
    isManager={isManager}
  />
);

  return (
    <main className="main-content">

      <div className="page-header">

        <div>

          <h1>
            Orario
          </h1>

          <p>
            {profile?.name
              ? `Welcome, ${profile.name}`
              : ""}
          </p>

        </div>

        {dataLoading && (
          <span className="sync-text">
            Loading...
          </span>
        )}

      </div>


      {/* MONTH NAVIGATION */}

      <div className="month-navigation">

        <button
          onClick={() =>
            setMonth(
              new Date(
                month.getFullYear(),
                month.getMonth() - 1,
                1
              )
            )
          }
        >
          ‹
        </button>

        <strong>
          {month.toLocaleDateString(
            "it-IT",
            {
              month: "long",
              year: "numeric"
            }
          )}
        </strong>

        <button
          onClick={() =>
            setMonth(
              new Date(
                month.getFullYear(),
                month.getMonth() + 1,
                1
              )
            )
          }
        >
          ›
        </button>

        <button
          className="today-button"
          onClick={() =>
            setMonth(new Date())
          }
        >
          Oggi
        </button>

      </div>


      {/* TABLE */}

      <div className="table-wrapper">

        <div className="timetable">

          <div className="table-row table-header">

            <div className="employee-column">
              EMPLOYEE
            </div>

            {monthDates.map(
              (date) => (

                <div
                  className={
                    sameDay(
                      date,
                      new Date()
                    )
                      ? "day-column today"
                      : "day-column"
                  }
                  key={
                    date.toISOString()
                  }
                >

                  <span>
                    {date.toLocaleDateString(
                      "it-IT",
                      {
                        weekday:
                          "short"
                      }
                    )}
                  </span>

                  <strong>
                    {date.getDate()}
                  </strong>

                </div>

              )
            )}

          </div>


          {employees.length === 0 ? (

            <div className="empty-state">
              No employees yet.
            </div>

          ) : (

            employees.map(
              (employee) => (

                <div
                  className="table-row"
                  key={employee.id}
                >

                  <div className="employee-column employee-name">
                    {employee.name}
                  </div>

                  {monthDates.map(
                    (date) => {

                      const dayShifts =
                        shifts
                          .filter(
                            (shift) =>
                              shift.employeeID ===
                                employee.id &&
                              sameDay(
                                shift.date,
                                date
                              )
                          )
                          .sort(
                            (a, b) =>
                              a.start -
                              b.start
                          );

                      return (

                        <div
                          className="day-column shift-cell"
                          key={
                            date.toISOString()
                          }
                        >

                          {dayShifts.length >
                          0 ? (

                            <div className="shift-list">

                              {dayShifts.map(
                                (shift) => (

                                  <button
                                    key={
                                      shift.id
                                    }
                                    className="shift-card"
                                    onClick={() =>
                                      isManager &&
                                      openEditShift(
                                        shift
                                      )
                                    }
                                    disabled={
                                      !isManager
                                    }
                                  >

                                    <strong>
                                      {
                                        minutesToTime(
                                          shift.start
                                        )
                                      }
                                      {"–"}
                                      {
                                        minutesToTime(
                                          shift.end
                                        )
                                      }
                                    </strong>

                                    <span>
                                      {
                                        shift.department
                                      }
                                    </span>

                                    <small>
                                      {
                                        durationText(
                                          shift.start,
                                          shift.end
                                        )
                                      }
                                    </small>

                                  </button>

                                )
                              )}

                            </div>

                          ) : (

                            isManager ? (

                              <button
                                className="empty-cell"
                                onClick={() =>
                                  openAddShift(
                                    date
                                  )
                                }
                              >
                                +
                              </button>

                            ) : (

                              <span className="dash">
                                —
                              </span>

                            )
                          )}

                        </div>

                      );
                    }
                  )}

                </div>

              )
            )
          )}

        </div>

      </div>


      <div className="info-row">

        <span>
          {employees.length} employee
          {employees.length !== 1
            ? "s"
            : ""}
        </span>

        <span>
          {shifts.filter(
            (shift) =>
              shift.date.getMonth() ===
                month.getMonth() &&
              shift.date.getFullYear() ===
                month.getFullYear()
          ).length} shifts
        </span>

        {isManager && (

          <button
            className="add-shift-button"
            onClick={() =>
              openAddShift(
                new Date()
              )
            }
          >
            + Aggiungi turno
          </button>

        )}

      </div>

    </main>
  );
}


// ============================================================
// EMPLOYEES VIEW
// ============================================================

function EmployeesView({
  employees,
  shifts,
  isManager,
  showAddEmployee,
  setShowAddEmployee,
  newEmployeeName,
  setNewEmployeeName,
  newEmployeeEmail,
  setNewEmployeeEmail,
  addEmployee,
  deleteEmployee
}) {

  return (
    <main className="section-content">

      <div className="section-heading">

        <div>

          <h1>
            DIPENDENTE
          </h1>

          <p>
            {employees.length} employee
            {employees.length !== 1
              ? "s"
              : ""}
          </p>

        </div>

        {isManager && (

          <button
            className="primary-button"
            onClick={() =>
              setShowAddEmployee(true)
            }
          >
            + Aggiungi dipendente
          </button>

        )}

      </div>


      <div className="employee-grid">

        {employees.length === 0 ? (

          <div className="empty-panel">
            No DIPENDENTE yet.
          </div>

        ) : (

          employees.map(
            (employee) => {

              const employeeShifts =
                shifts.filter(
                  (shift) =>
                    shift.employeeID ===
                    employee.id
                );

              const totalMinutes =
                employeeShifts.reduce(
                  (
                    total,
                    shift
                  ) =>
                    total +
                    durationMinutes(
                      shift.start,
                      shift.end
                    ),
                  0
                );

              const initials =
                employee.name
                  .split(" ")
                  .map(
                    (part) =>
                      part[0]
                  )
                  .join("")
                  .slice(0, 2)
                  .toUpperCase();

              return (

                <div
                  className="employee-card"
                  key={employee.id}
                >

                  <div className="employee-avatar">
                    {initials}
                  </div>

                  <div className="employee-card-info">

                    <h3>
                      {employee.name}
                    </h3>

                    <p>
                      {employeeShifts.length}
                      {" "}
                      shift
                      {employeeShifts.length !== 1
                        ? "s"
                        : ""}
                      {" · "}
                      {formatHours(
                        totalMinutes
                      )}
                    </p>

                  </div>

                  {isManager && (

                    <button
                      className="icon-delete-button"
                      title="Delete employee"
                      onClick={() =>
                        deleteEmployee(
                          employee
                        )
                      }
                    >
                      🗑
                    </button>

                  )}

                </div>

              );
            }
          )

        )}

      </div>


      {/* ADD EMPLOYEE MODAL */}

      {showAddEmployee && (

        <div className="modal-backdrop">

          <div className="modal small-modal">

            <div className="modal-header">

              <div>

                <h2>
                  Aggiungi dipendente
                </h2>

                <p>
                  Aggiungere un dipendente all'orario VOLUME.
                </p>

              </div>

              <button
                className="close-button"
                onClick={() => {

                  setShowAddEmployee(
                    false
                  );

                  setNewEmployeeName("");

                }}
              >
                ×
              </button>

            </div>


            <div className="form">

              <label>

                Nome del dipendente

                <input
                  type="text"
                  placeholder="e.g. Mike"
                  value={
                    newEmployeeName
                  }
                  onChange={(event) =>
                    setNewEmployeeName(
                      event.target.value
                    )
                  }
                  autoFocus
                />

              </label>
              <label>

  Email del dipendente

  <input
    type="email"
    placeholder="e.g. mike@email.com"
    value={
      newEmployeeEmail
    }
    onChange={(event) =>
      setNewEmployeeEmail(
        event.target.value
      )
    }
  />

</label>


              <div className="form-actions">

                <div />

                <div className="right-actions">

                  <button
                    className="secondary-button"
                    onClick={() => {

                      setShowAddEmployee(
                        false
                      );

                      setNewEmployeeName("");

                    }}
                  >
                    Annulla
                  </button>

                  <button
                    className="primary-button"
                    disabled={
  !newEmployeeName.trim() ||
  !newEmployeeEmail.trim()
}
                    onClick={
                      addEmployee
                    }
                  >
                    Aggiungi dipendente
                  </button>

                </div>

              </div>

            </div>

          </div>

        </div>

      )}

    </main>
  );
}


// ============================================================
// HOURS VIEW
// ============================================================

function HoursView({
  month,
  setMonth,
  employees,
  shifts
}) {

  const monthStart =
    new Date(
      month.getFullYear(),
      month.getMonth(),
      1
    );

  const monthEnd =
    new Date(
      month.getFullYear(),
      month.getMonth() + 1,
      1
    );

  const monthShifts =
    shifts.filter(
      (shift) =>
        shift.date >= monthStart &&
        shift.date < monthEnd
    );


  return (
    <main className="section-content">

      <div className="section-heading">

        <div>

          <h1>
            Ore
          </h1>

          <p>
            Ore e giorni lavorati
          </p>

        </div>

      </div>


      <div className="hours-navigation">

        <button
          onClick={() =>
            setMonth(
              new Date(
                month.getFullYear(),
                month.getMonth() - 1,
                1
              )
            )
          }
        >
          ‹
        </button>

        <strong>
          {month.toLocaleDateString(
            "it-IT",
            {
              month: "long",
              year: "numeric"
            }
          )}
        </strong>

        <button
          onClick={() =>
            setMonth(
              new Date(
                month.getFullYear(),
                month.getMonth() + 1,
                1
              )
            )
          }
        >
          ›
        </button>

        <button
          className="today-button"
          onClick={() =>
            setMonth(new Date())
          }
        >
          Oggi
        </button>

      </div>


      <div className="hours-grid">

        {employees.map(
          (employee) => {

            const employeeShifts =
              monthShifts.filter(
                (shift) =>
                  shift.employeeID ===
                  employee.id
              );

            const totalMinutes =
              employeeShifts.reduce(
                (
                  total,
                  shift
                ) =>
                  total +
                  durationMinutes(
                    shift.start,
                    shift.end
                  ),
                0
              );

            const workedDays =
              new Set(
                employeeShifts.map(
                  (shift) =>
                    startOfDay(
                      shift.date
                    ).getTime()
                )
              ).size;

            return (

              <div
                className="hours-card"
                key={employee.id}
              >

                <div>

                  <h3>
                    {employee.name}
                  </h3>

                  <p>
                    {employeeShifts.length}
                    {" "}
                    shift
                    {employeeShifts.length !== 1
                      ? "s"
                      : ""}
                  </p>

                </div>

                <div className="hours-values">

                  <div>

                    <strong>
                      {workedDays}
                    </strong>

                    <span>
                      giorni
                    </span>

                  </div>

                  <div>

                    <strong>
                      {formatHours(
                        totalMinutes
                      )}
                    </strong>

                    <span>
                      ore totali
                    </span>

                  </div>

                </div>

              </div>

            );
          }
        )}

      </div>


      {employees.length === 0 && (

        <div className="empty-panel">
          Nessun dipendente ancora.
        </div>

      )}

    </main>
  );
}

// ============================================================
// REQUESTS VIEW
// ============================================================

function RequestsView({
  isManager,
  profile,
  user,
  requests,
  employees,
  shifts,
  onCreateDayOff,
  onApprove,
  onReject
}) {

  const [showNewRequest, setShowNewRequest] =
    useState(false);

  const [selectedRequest, setSelectedRequest] =
    useState(null);

  const [decision, setDecision] =
    useState(null);

  const [comment, setComment] =
    useState("");


function employeeName(employeeID) {

  const employee =
    employees.find(
      (item) =>
        item.authUID === employeeID
    );

  if (employee) {
    return employee.name;
  }

  return "Employee";
}
    const shiftsForUser =
    shifts
      .filter((shift) => {

        const employee =
          employees.find(
            (item) =>
              item.authUID === user?.uid
          );

        if (employee) {
          return (
            shift.employeeID ===
            employee.id
          );
        }

        const profileEmployee =
          employees.find(
            (item) =>
              item.name
                .trim()
                .toLowerCase() ===
              profile?.name
                ?.trim()
                .toLowerCase()
          );

        return (
          profileEmployee &&
          shift.employeeID ===
            profileEmployee.id
        );
      })
      .filter((shift) => {

        const today =
          startOfDay(
            new Date()
          );

        return (
          shift.date >= today
        );
      })
      .sort(
        (a, b) =>
          a.date - b.date ||
          a.start - b.start
      );


  function formatRequestDate(date) {

    if (!date) {
      return "—";
    }

    return date.toLocaleDateString(
      "it-IT",
      {
        weekday: "short",
        day: "numeric",
        month: "long",
        year: "numeric"
      }
    );
  }


  async function submitDecision() {

    if (
      !selectedRequest ||
      !decision
    ) {
      return;
    }

    try {

      if (
        decision ===
        "approve"
      ) {

        await onApprove(
          selectedRequest,
          comment
        );

      } else {

        await onReject(
          selectedRequest,
          comment
        );
      }

      setSelectedRequest(null);
      setDecision(null);
      setComment("");

    } catch {

      // Error is already displayed by App.
    }
  }


  return (
    <main className="section-content">

      <div className="section-heading">

        <div>

          <h1>
            {isManager
              ? "Richieste"
              : "Le mie richieste"}
          </h1>

          <p>
            {isManager
              ? "Esaminare le richieste dei dipendenti"
              : "Richiedi ferie o modifiche"}
          </p>

        </div>

        {!isManager && (

          <button
            className="primary-button"
            onClick={() =>
              setShowNewRequest(true)
            }
          >
            + Nuova richiesta
          </button>

        )}

      </div>


      {requests.length === 0 ? (

        <div className="empty-panel">

          <div className="coming-icon">
            🔄
          </div>

          <h3>
            Nessuna richiesta
          </h3>

          <p>
            {isManager
              ? "There are no employee requests yet."
              : "You haven't submitted any requests yet."}
          </p>

        </div>

      ) : (

        <div className="requests-list">

          {requests.map(
            (request) => (

              <div
                className="request-card"
                key={request.id}
              >

                <div className="request-main">

                  <div className="request-top">

                    <div>

                      <span className="request-type">
                        {request.type}
                      </span>

                      {isManager && (

                        <h3>
                          {
                            employeeName(
                              request.employeeID
                            )
                          }
                        </h3>

                      )}

                    </div>

                    <span
                      className={
                        `request-status ${request.status}`
                      }
                    >
                      {request.status}
                    </span>

                  </div>


                  <div className="request-date">

                    <strong>
                      Data richiesta
                    </strong>

                    <span>
                      {
                        formatRequestDate(
                          request.requestedDate
                        )
                      }
                    </span>

                  </div>
                  {request.type === "Shift Swap" && (

  <div className="request-date">

    <strong>
      {isManager
        ? `${employeeName(request.employeeID)}'s shift`
        : "Your shift"}
    </strong>

    <span>
      {(() => {

        const ownShift =
          shifts.find(
            (shift) =>
              shift.id ===
              request.shiftID
          );

        if (!ownShift) {
          return "—";
        }

        return (
          <>
            {formatRequestDate(
              ownShift.date
            )}
            {" · "}
            {minutesToTime(
              ownShift.start
            )}
            {"–"}
            {minutesToTime(
              ownShift.end
            )}
            {" · "}
            {ownShift.department}
          </>
        );

      })()}
    </span>


    <strong>
      Scambia con
    </strong>

    <span>
      {(() => {

        const replacementEmployee =
          employees.find(
            (employee) =>
              employee.id ===
              request.replacementEmployeeID
          );

        return replacementEmployee
          ? replacementEmployee.name
          : "—";

      })()}
    </span>


    <strong>
      Il loro turno
    </strong>

    <span>
      {(() => {

        const replacementShift =
          shifts.find(
            (shift) =>
              shift.id ===
              request.replacementShiftID
          );

        if (!replacementShift) {
          return "—";
        }

        return (
          <>
            {formatRequestDate(
              replacementShift.date
            )}
            {" · "}
            {minutesToTime(
              replacementShift.start
            )}
            {"–"}
            {minutesToTime(
              replacementShift.end
            )}
            {" · "}
            {replacementShift.department}
          </>
        );

      })()}
    </span>

  </div>

)}
                  {isManager &&
  request.type === "Shift Change" && (

    <div className="request-date">

      <strong>
        Current shift
      </strong>

      <span>
        {(() => {

          const currentShift =
            shifts.find(
              (shift) =>
                shift.id ===
                request.shiftID
            );

          if (!currentShift) {
            return "—";
          }

          return (
            <>
              {minutesToTime(
                currentShift.start
              )}
              {"–"}
              {minutesToTime(
                currentShift.end
              )}
            </>
          );

        })()}
      </span>

      <strong>
        Requested shift
      </strong>

      <span>
        {request.proposedStart !== null
          ? minutesToTime(
              request.proposedStart
            )
          : "—"}
        {"–"}
        {request.proposedEnd !== null
          ? minutesToTime(
              request.proposedEnd
            )
          : "—"}
      </span>

    </div>

)}


                  {request.reason && (

                    <div className="request-reason">

                      <strong>
                        Motivo
                      </strong>

                      <p>
                        {request.reason}
                      </p>

                    </div>

                  )}


                  {request.managerComment && (

                    <div className="manager-comment">

                      <strong>
                        Commento del manager
                      </strong>

                      <p>
                        {request.managerComment}
                      </p>

                    </div>

                  )}

                </div>


                {isManager &&
                  request.status ===
                    "pending" && (

                    <div className="request-actions">

                      <button
                        className="reject-request-button"
                        onClick={() => {

                          setSelectedRequest(
                            request
                          );

                          setDecision(
                            "reject"
                          );

                          setComment("");

                        }}
                      >
                        Reject
                      </button>

                      <button
                        className="approve-request-button"
                        onClick={() => {

                          setSelectedRequest(
                            request
                          );

                          setDecision(
                            "approve"
                          );

                          setComment("");

                        }}
                      >
                        Approve
                      </button>

                    </div>

                  )}

              </div>

            )
          )}

        </div>

      )}


      {/* NEW REQUEST */}

     {showNewRequest && (

  <NewDayOffRequest
  shifts={shiftsForUser}
  allShifts={shifts}
  employees={employees}
  user={user}
    onClose={() =>
      setShowNewRequest(
        false
      )
    }
          onSubmit={
  async ({
    shift,
    requestType,
    newStart,
    newEnd,
    swapEmployeeID,
    swapShiftID,
    reason
  }) => {

    await onCreateDayOff({
      shift,
      requestType,
      newStart,
      newEnd,
      swapEmployeeID,
      swapShiftID,
      reason
    });

    setShowNewRequest(
      false
    );
  }
}
        />

      )}


      {/* MANAGER DECISION */}

      {selectedRequest &&
        decision && (

          <div className="modal-backdrop">

            <div className="modal small-modal">

              <div className="modal-header">

                <div>

                  <h2>
                    {decision ===
                    "approve"
                      ? "Approve Request"
                      : "Reject Request"}
                  </h2>

                  <p>
                    {
                      employeeName(
                        selectedRequest.employeeID
                      )
                    }
                    {" · "}
                    {selectedRequest.type}
                  </p>

                </div>

                <button
                  className="close-button"
                  onClick={() => {

                    setSelectedRequest(
                      null
                    );

                    setDecision(
                      null
                    );

                  }}
                >
                  ×
                </button>

              </div>


              <div className="form">

               {selectedRequest.type === "Shift Swap" ? (

  <div className="decision-information">

    <strong>
      {employeeName(selectedRequest.employeeID)}'s shift
    </strong>

    <span>
      {(() => {

        const ownShift =
          shifts.find(
            (shift) =>
              shift.id ===
              selectedRequest.shiftID
          );

        if (!ownShift) {
          return "—";
        }

        return (
          <>
            {formatRequestDate(
              ownShift.date
            )}
            {" · "}
            {minutesToTime(
              ownShift.start
            )}
            {"–"}
            {minutesToTime(
              ownShift.end
            )}
            {" · "}
            {ownShift.department}
          </>
        );

      })()}
    </span>


    <strong>
      Scambia con
    </strong>

    <span>
      {(() => {

        const replacementEmployee =
          employees.find(
            (employee) =>
              employee.id ===
              selectedRequest.replacementEmployeeID
          );

        return replacementEmployee
          ? replacementEmployee.name
          : "—";

      })()}
    </span>


    <strong>
      Their shift
    </strong>

    <span>
      {(() => {

        const replacementShift =
          shifts.find(
            (shift) =>
              shift.id ===
              selectedRequest.replacementShiftID
          );

        if (!replacementShift) {
          return "—";
        }

        return (
          <>
            {formatRequestDate(
              replacementShift.date
            )}
            {" · "}
            {minutesToTime(
              replacementShift.start
            )}
            {"–"}
            {minutesToTime(
              replacementShift.end
            )}
            {" · "}
            {replacementShift.department}
          </>
        );

      })()}
    </span>

  </div>

) : (

  <div className="decision-information">

    <strong>
      Requested date
    </strong>

    <span>
      {
        formatRequestDate(
          selectedRequest.requestedDate
        )
      }
    </span>

  </div>

)}


                <label>

                  Manager comment
                  <span className="label-help">
                    Optional
                  </span>

                  <textarea
                    value={comment}
                    onChange={(event) =>
                      setComment(
                        event.target.value
                      )
                    }
                    placeholder="Add a comment..."
                    rows="4"
                  />

                </label>


                <div className="form-actions">

                  <div />

                  <div className="right-actions">

                    <button
                      className="secondary-button"
                      onClick={() => {

                        setSelectedRequest(
                          null
                        );

                        setDecision(
                          null
                        );

                      }}
                    >
                      Cancel
                    </button>

                    <button
                      className={
                        decision ===
                        "approve"
                          ? "approve-request-button"
                          : "reject-request-button"
                      }
                      onClick={
                        submitDecision
                      }
                    >
                      {decision ===
                      "approve"
                        ? "Approve"
                        : "Reject"}
                    </button>

                  </div>

                </div>

              </div>

            </div>

          </div>

        )}

    </main>
  );
}


// ============================================================
// NEW DAY OFF REQUEST
// ============================================================

function NewDayOffRequest({
  
  shifts,
  allShifts,
  employees,
  user,
  onClose,
  onSubmit
}) {
  const [selectedShiftID, setSelectedShiftID] =
    useState("");
    const [requestType, setRequestType] =
  useState("Day Off");
  const [swapEmployeeID, setSwapEmployeeID] =
  useState("");
  const [swapShiftID, setSwapShiftID] =
  useState("");
  const [newStart, setNewStart] =
  useState(null);

const [newEnd, setNewEnd] =
  useState(null);
  const [reason, setReason] =
    useState("");

  const [saving, setSaving] =
    useState(false);

  const selectedShift =
    shifts.find(
      (shift) =>
        shift.id === selectedShiftID
    );
    const swapShifts =
  allShifts
    .filter(
      (shift) =>
        shift.employeeID ===
          swapEmployeeID &&
        shift.date >=
          startOfDay(new Date())
    )
    .sort(
      (a, b) =>
        a.date - b.date ||
        a.start - b.start
    );
    useEffect(() => {
  if (selectedShift) {
    setNewStart(selectedShift.start);
    setNewEnd(selectedShift.end);
  }
}, [selectedShift]);

  function formatShiftDate(date) {
    return date.toLocaleDateString(
      "it-IT",
      {
        weekday: "short",
        day: "numeric",
        month: "long",
        year: "numeric"
      }
    );
  }

  async function submit() {

    if (!selectedShift) {
      return;
    }

    setSaving(true);

    try {

      await onSubmit({

  shift: selectedShift,

  requestType,

  newStart,

  newEnd,

  swapEmployeeID,

  swapShiftID,

  reason
});

    } finally {

      setSaving(false);

    }
  }

  return (
    <div className="modal-backdrop">

      <div className="modal small-modal">

        <div className="modal-header">

          <div>

            <h2>
              New Request
            </h2>

            <p>
              Select one of your scheduled shifts
            </p>

          </div>

          <button
            className="close-button"
            onClick={onClose}
          >
            ×
          </button>

        </div>


        <div className="form">

          {shifts.length === 0 ? (

            <div className="empty-panel">

              <div className="coming-icon">
                📅
              </div>

              <h3>
                No shifts scheduled
              </h3>

              <p>
                You don't currently have
                any upcoming shifts that you
                can request a day off for.
              </p>

            </div>

          ) : (

            <>

              <label>

                Select your shift

                <select
                  value={selectedShiftID}
                  onChange={(event) =>
                    setSelectedShiftID(
                      event.target.value
                    )
                  }
                >

                  <option value="">
                    Choose a shift...
                  </option>

                  {shifts.map(
                    (shift) => (

                      <option
                        value={shift.id}
                        key={shift.id}
                      >

                        {formatShiftDate(
                          shift.date
                        )}

                        {" · "}

                        {minutesToTime(
                          shift.start
                        )}

                        {"–"}

                        {minutesToTime(
                          shift.end
                        )}

                        {" · "}

                        {shift.department}

                      </option>

                    )
                  )}

                </select>

              </label>


              {selectedShift && (

                <div className="decision-information">

                  <strong>
                    Selected shift
                  </strong>

                  <span>

                    {formatShiftDate(
                      selectedShift.date
                    )}

                    {" · "}

                    {minutesToTime(
                      selectedShift.start
                    )}

                    {"–"}

                    {minutesToTime(
                      selectedShift.end
                    )}

                    {" · "}

                    {selectedShift.department}

                  </span>

                </div>

              )}


             <div className="request-type-selector">

  <button
    type="button"
    className={
      requestType === "Day Off"
        ? "selected-request-type"
        : "request-type-option"
    }
    onClick={() =>
      setRequestType("Day Off")
    }
  >
    <span>
      Giorno libero
    </span>

    <small>
      Richiedi un giorno libero per questo turno
    </small>
  </button>

  <button
    type="button"
    className={
      requestType === "Shift Change"
        ? "selected-request-type"
        : "request-type-option"
    }
    onClick={() =>
      setRequestType("Shift Change")
    }
  >
    <span>
      Modifica del turno
    </span>

    <small>
      Richiedi orari di lavoro diversi
    </small>
  </button>
  <button
  type="button"
  className={
    requestType === "Shift Swap"
      ? "selected-request-type"
      : "request-type-option"
  }
  onClick={() =>
    setRequestType("Shift Swap")
  }
>
  <span>
    Scambio di turno
  </span>

  <small>
Scambia questo turno con un altro dipendente
  </small>
</button>

</div>


            {requestType === "Shift Change" && (

  <>
    <label>

      Nuovo orario di inizio

      <select
  value={newStart ?? ""}
  onChange={(event) =>
    setNewStart(
      Number(event.target.value)
    )
  }
>
  <TimeOptions />
</select>

    </label>

    <label>

      Nuovo orario di fine

     <select
  value={newEnd ?? ""}
  onChange={(event) =>
    setNewEnd(
      Number(event.target.value)
    )
  }
>
  <TimeOptions />
</select>

    </label>
  </>

)}
{requestType === "Shift Swap" && (

  <>
    <label>
      Scambia con

<select
  value={swapEmployeeID}
  onChange={(event) =>
    setSwapEmployeeID(
      event.target.value
    )
  }
>
  <option value="">
    Scegli un dipendente...
  </option>

  {employees
    .filter(
      (employee) =>
        employee.authUID !== user?.uid
    )
    .map(
      (employee) => (
        <option
          value={employee.id}
          key={employee.id}
        >
          {employee.name}
        </option>
      )
    )}
</select>
    </label>
    {swapEmployeeID && (

  <label>
    Il loro turno

    <select
      value={swapShiftID}
      onChange={(event) =>
        setSwapShiftID(
          event.target.value
        )
      }
    >
      <option value="">
        Scegli il loro turno...
      </option>

      {swapShifts.map(
        (shift) => (
          <option
            value={shift.id}
            key={shift.id}
          >
            {formatShiftDate(
              shift.date
            )}
            {" · "}
            {minutesToTime(
              shift.start
            )}
            {"–"}
            {minutesToTime(
              shift.end
            )}
            {" · "}
            {shift.department}
          </option>
        )
      )}
    </select>

  </label>

)}
  </>
)}

<label>

  Motivo

  <span className="label-help">
    Optional
  </span>

  <textarea
    value={reason}
    onChange={(event) =>
      setReason(
        event.target.value
      )
    }
    placeholder={
      requestType === "Shift Change"
        ? "Perché hai bisogno di orari di lavoro diversi?"
        : "Perché hai bisogno di questo giorno libero?"
    }
    rows="4"
  />

</label>


              <div className="request-warning">

                <strong>
                  Important
                </strong>

                <span>
                  L'invio di una richiesta lo fa
                  non cambiare il funzionario
                  orario. Il direttore deve
                  approvalo prima.
                </span>

              </div>

            </>

          )}


          <div className="form-actions">

            <div />

            <div className="right-actions">

              <button
                className="secondary-button"
                onClick={onClose}
                disabled={saving}
              >
                Cancel
              </button>

              {shifts.length > 0 && (

                <button
                  className="primary-button"
                  onClick={submit}
                  disabled={
  saving ||
  !selectedShift ||
  (
    requestType === "Shift Change" &&
    (
      newStart === null ||
      newEnd === null ||
      newStart === newEnd
    )
  ) ||
  (
    requestType === "Shift Swap" &&
    (
      !swapEmployeeID ||
      !swapShiftID
    )
  )
}
                >

                  {saving
                    ? "Submitting..."
                    : "Submit Request"}

                </button>

              )}

            </div>

          </div>

        </div>

      </div>

    </div>
  );
}


function NotificationsView({
  notifications
}) {

  return (
    <main className="section-content">

      <div className="section-heading">

        <div>

          <h1>
            Notifiche
          </h1>

          <p>
            Aggiornamenti da VOLUME
          </p>

        </div>

      </div>


      {notifications.length === 0 ? (

        <div className="empty-panel">

          <div className="coming-icon">
            🔔
          </div>

          <h3>
            Nessuna notifica
          </h3>

          <p>
            Sei al passo con gli aggiornamenti.
          </p>

        </div>

      ) : (

        <div className="requests-list">

          {notifications.map(
            (notification) => (

              <div
                className="request-card"
                key={notification.id}
              >

                <div className="request-main">

                  <div className="request-top">

                    <div>

                      <span className="request-type">
                        {notification.type ===
                        "timetable_published"
                          ? "Timetable"
                          : "VOLUME"}
                      </span>

                      <h3>
                        {notification.title}
                      </h3>

                    </div>

                  </div>


                  <div className="request-reason">

                    <p>
                      {notification.message}
                    </p>

                  </div>

                </div>

              </div>

            )
          )}

        </div>

      )}

    </main>
  );
}


// ============================================================
// SHIFT EDITOR
// ============================================================

function ShiftEditor({
  shift,
  date,
  defaultDepartment,
  employees,
  onClose,
  onSave,
  onDelete
}) {

  const [employeeID, setEmployeeID] =
    useState(
      shift?.employeeID ||
      employees[0]?.id ||
      ""
    );

  const [selectedDate, setSelectedDate] =
    useState(
      formatDateInput(
        shift?.date || date
      )
    );

  const [start, setStart] =
    useState(
      shift?.start ?? 780
    );

  const [end, setEnd] =
    useState(
      shift?.end ?? 1320
    );

   const [departments, setDepartments] =
    useState(
      shift?.departments ||
      [shift?.department || defaultDepartment || "Bar"]
    );


  function save() {

    const parsedDate =
      new Date(
        `${selectedDate}T00:00:00`
      );

    onSave({

      employeeID,

      date:
        parsedDate,

      start:
        Number(start),

      end:
        Number(end),

      department: departments[0],

      departments

    });
  }


  return (
    <div className="modal-backdrop">

      <div className="modal">

        <div className="modal-header">

          <div>

            <h2>
              {shift
                ? "Modifica Turno"
                : "Aggiungi turno"}
            </h2>

            <p>
              {shift
                ? "Aggiornare l'orario ufficiale"
                : "Creare un nuovo turno ufficiale"}
            </p>

          </div>

          <button
            className="close-button"
            onClick={onClose}
          >
            ×
          </button>

        </div>


        <div className="form">

          <label>

            DIPENDENTE

            <select
              value={employeeID}
              onChange={(event) =>
                setEmployeeID(
                  event.target.value
                )
              }
            >

              {employees.map(
                (employee) => (

                  <option
                    value={employee.id}
                    key={employee.id}
                  >
                    {employee.name}
                  </option>

                )
              )}

            </select>

          </label>


          <label>

            Data

            <input
              type="date"
              value={selectedDate}
              onChange={(event) =>
                setSelectedDate(
                  event.target.value
                )
              }
            />

          </label>


                    <label>
            DIPARTIMENTI

            <div className="form-checkboxes">
              {[
                "Bar",
                "Sala",
                "Piattini",
                "Preparazione/Ricevimento"
              ].map((item) => (
                <label key={item}>
                  <input
                    type="checkbox"
                    checked={departments.includes(item)}
                    onChange={(event) => {
                      setDepartments((current) =>
                        event.target.checked
                          ? [...current, item]
                          : current.filter((value) => value !== item)
                      );
                    }}
                  />
                  {item}
                </label>
              ))}
            </div>
          </label>

          <label>

            Inizio

            <select
              value={start}
              onChange={(event) =>
                setStart(
                  Number(
                    event.target.value
                  )
                )
              }
            >

              <TimeOptions />

            </select>

          </label>


          <label>

            Fine

            <select
              value={end}
              onChange={(event) =>
                setEnd(
                  Number(
                    event.target.value
                  )
                )
              }
            >

              <TimeOptions />

            </select>

          </label>


          <div className="duration-box">

            <span>
              Durata
            </span>

            <strong>
              {durationText(
                Number(start),
                Number(end)
              )}
            </strong>

          </div>


          <div className="form-actions">

            {shift ? (

              <button
                className="delete-button"
                onClick={() =>
                  onDelete(shift)
                }
              >
                Elimina Turno
              </button>

            ) : (

              <div />

            )}

            <div className="right-actions">

              <button
                className="secondary-button"
                onClick={onClose}
              >
                Annulla
              </button>

              <button
                className="primary-button"
                onClick={save}
                disabled={!employeeID}
              >
                Salva
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
// ============================================================
// TIME OPTIONS
// ============================================================

function TimeOptions() {
  const options = [];
  for (
    let minute = 0;
    minute < 1440;
    minute += 30
  ) {
    options.push(
      <option
        value={minute}
        key={minute}
      >
        {minutesToTime(minute)}
      </option>

    );
  }
  return options;
}
export default App;