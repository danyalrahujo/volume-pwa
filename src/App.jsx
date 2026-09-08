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
                    || "Bar"

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
    department
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
      "Create request error:",
      err
    );

    setError(
      "Could not submit request."
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
      "Shift Change request is missing shift or requested hours."
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
      "Shift Swap request is missing one of the shifts."
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
      "One of the shifts in this swap could not be found."
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
        "approved",

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
            TIMETABLE
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
            TIMETABLE
          </span>

        </div>

        <div className="user-area">
          <button
  onClick={enablePushNotifications}
>
  🔔 Enable Notifications
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
            Sign Out
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
          📅 Timetable
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
          👥 Employees
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
          ⏱ Hours
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
          🔄 Requests
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
  🔔 Notifications
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
  openEditShift
}) {

  const departments = [
    "Bar",
    "Sala",
    "Pattini",
    "Ricevimento"
  ];

  const [weekDate, setWeekDate] =
    useState(new Date());

    const [showPublishModal, setShowPublishModal] =
  useState(false);
  const [publishPeriod, setPublishPeriod] =
  useState("this-week");
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
    "en-US",
    {
      month: "long",
      day: "numeric",
      year: "numeric"
    }
  ) +
  "–" +
  publicationEnd.toLocaleDateString(
    "en-US",
    {
      month: "long",
      day: "numeric",
      year: "numeric"
    }
  );

const publicationRef =
  await addDoc(
    collection(db, "publications"),
    {
      type: publishPeriod,

      startDate:
        Timestamp.fromDate(
          publicationStart
        ),

      endDate:
        Timestamp.fromDate(
          publicationEnd
        ),

      createdAt:
        serverTimestamp()
    }
  );


await addDoc(
  collection(db, "notifications"),
  {
    type: "timetable_published",

    title:
      "Timetable Published",

    message:
  `The timetable for ${periodText} is now available.`,

    publicationID:
      publicationRef.id,

    createdAt:
      serverTimestamp(),

    read: false
  }
);

    setShowPublishModal(false);

    alert("Timetable published");

  } catch (error) {

    console.error(
      "Publish timetable error:",
      error
    );

    alert(
      `Publish error: ${error.message}`
    );
  }
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
        "en-US",
        {
          month: "long"
        }
      );

    const lastMonth =
      last.toLocaleDateString(
        "en-US",
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
            Timetable
          </h1>

          <p>
            Manage shifts by department
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
          Today
        </button>

      </div>


      {/* DEPARTMENT TABLE */}

      <div className="table-wrapper">

        <div className="timetable">

          {/* HEADER */}

          <div className="table-row table-header">

            <div className="employee-column">
              DEPARTMENT
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
                      "en-US",
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
                            shift.department ===
                              department &&
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

    {dayShifts.map(
      (shift) => (

        <button
          key={shift.id}
          className="shift-card"
          onClick={() =>
            openEditShift(shift)
          }
        >

          <strong>
            {
              employeeName(
                shift.employeeID
              )
            }
          </strong>

          <span>
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

    <button
      className="empty-cell"
      onClick={() =>
        openAddShift(
          date,
          department
        )
      }
    >
      +
    </button>

  </div>

) : (

  <button
    className="empty-cell"
    onClick={() =>
      openAddShift(
        date,
        department
      )
    }
  >
    +
  </button>

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
    Week view
  </span>

  <div className="info-actions">

    <button
  className="publish-button"
  onClick={() =>
    setShowPublishModal(true)
  }
>
  📢 Publish Timetable
</button>

    <button
      className="add-shift-button"
      onClick={() =>
        openAddShift(
          new Date()
        )
      }
    >
      + Add Shift
    </button>

  </div>

</div>
{showPublishModal && (

  <div className="modal-backdrop">

    <div className="modal">

      <div className="modal-header">

        <div>

          <h2>
            Publish Timetable
          </h2>

          <p>
            Choose the period you want to publish.
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
          Timetable period

          <select
  value={publishPeriod}
  onChange={(event) =>
    setPublishPeriod(
      event.target.value
    )
  }
>

            <option value="this-week">
              This week
            </option>

            <option value="next-week">
              Next week
            </option>

            <option value="two-weeks">
              Next 2 weeks
            </option>

            <option value="this-month">
              This month
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
              Cancel
            </button>

            <button
  className="primary-button"
  onClick={publishTimetable}
>
  Publish
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
    if (isManager) {

    return (
      <ManagerDepartmentTimetable
        shifts={shifts}
        employees={employees}
        openAddShift={openAddShift}
        openEditShift={openEditShift}
      />
    );

  }

  return (
    <main className="main-content">

      <div className="page-header">

        <div>

          <h1>
            Timetable
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
            "en-US",
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
          Today
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
                      "en-US",
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
            + Add Shift
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
            Employees
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
            + Add Employee
          </button>

        )}

      </div>


      <div className="employee-grid">

        {employees.length === 0 ? (

          <div className="empty-panel">
            No employees yet.
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
                  Add Employee
                </h2>

                <p>
                  Add an employee to the VOLUME timetable.
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

                Employee name

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

  Employee email

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
                    Cancel
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
                    Add Employee
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
            Hours
          </h1>

          <p>
            Hours and days worked
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
            "en-US",
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
          Today
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
                      days
                    </span>

                  </div>

                  <div>

                    <strong>
                      {formatHours(
                        totalMinutes
                      )}
                    </strong>

                    <span>
                      total hours
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
          No employees yet.
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
      "en-US",
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
              ? "Requests"
              : "My Requests"}
          </h1>

          <p>
            {isManager
              ? "Review employee requests"
              : "Request time off or changes"}
          </p>

        </div>

        {!isManager && (

          <button
            className="primary-button"
            onClick={() =>
              setShowNewRequest(true)
            }
          >
            + New Request
          </button>

        )}

      </div>


      {requests.length === 0 ? (

        <div className="empty-panel">

          <div className="coming-icon">
            🔄
          </div>

          <h3>
            No requests
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
                      Requested date
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
      Swap with
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
      Their shift
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
                        Reason
                      </strong>

                      <p>
                        {request.reason}
                      </p>

                    </div>

                  )}


                  {request.managerComment && (

                    <div className="manager-comment">

                      <strong>
                        Manager comment
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
      Swap with
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
      "en-US",
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
      Day Off
    </span>

    <small>
      Request a day off for this shift
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
      Shift Change
    </span>

    <small>
      Request different working hours
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
    Shift Swap
  </span>

  <small>
    Swap this shift with another employee
  </small>
</button>

</div>


            {requestType === "Shift Change" && (

  <>
    <label>

      New start time

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

      New end time

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
      Swap with

<select
  value={swapEmployeeID}
  onChange={(event) =>
    setSwapEmployeeID(
      event.target.value
    )
  }
>
  <option value="">
    Choose an employee...
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
    Their shift

    <select
      value={swapShiftID}
      onChange={(event) =>
        setSwapShiftID(
          event.target.value
        )
      }
    >
      <option value="">
        Choose their shift...
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

  Reason

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
        ? "Why do you need different working hours?"
        : "Why do you need this day off?"
    }
    rows="4"
  />

</label>


              <div className="request-warning">

                <strong>
                  Important
                </strong>

                <span>
                  Submitting a request does
                  not change the official
                  timetable. The manager must
                  approve it first.
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
            Notifications
          </h1>

          <p>
            Updates from VOLUME
          </p>

        </div>

      </div>


      {notifications.length === 0 ? (

        <div className="empty-panel">

          <div className="coming-icon">
            🔔
          </div>

          <h3>
            No notifications
          </h3>

          <p>
            You're all caught up.
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

 const [department, setDepartment] =
  useState(
    shift?.department ||
    defaultDepartment ||
    "Bar"
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

      department

    });
  }


  return (
    <div className="modal-backdrop">

      <div className="modal">

        <div className="modal-header">

          <div>

            <h2>
              {shift
                ? "Edit Shift"
                : "Add Shift"}
            </h2>

            <p>
              {shift
                ? "Update the official timetable"
                : "Create a new official shift"}
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

            Employee

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

            Date

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
  Department

  <div className="readonly-field">
    {department}
  </div>
</label>

          <label>

            Start

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

            End

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
              Duration
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
                Delete Shift
              </button>

            ) : (

              <div />

            )}

            <div className="right-actions">

              <button
                className="secondary-button"
                onClick={onClose}
              >
                Cancel
              </button>

              <button
                className="primary-button"
                onClick={save}
                disabled={!employeeID}
              >
                Save
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