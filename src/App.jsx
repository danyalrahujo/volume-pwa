import {
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

import { auth, db } from "./firebase";

import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut
} from "firebase/auth";

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

  const [selectedShift, setSelectedShift] =
    useState(null);

  const [showEditor, setShowEditor] =
    useState(false);

  const [editorDate, setEditorDate] =
    useState(new Date());

  const [showAddEmployee, setShowAddEmployee] =
    useState(false);

  const [newEmployeeName, setNewEmployeeName] =
    useState("");

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

  function openAddShift(date) {

    setSelectedShift(null);
    setEditorDate(date);
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
  reason
}) {

  if (!user || !shift) {
    return;
  }

  try {

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
          employee.name
            .trim()
            .toLowerCase() ===
          employeeName
      );

    if (!timetableEmployee) {

      throw new Error(
        `Could not find ${employeeName} in the timetable employees.`
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

    if (!cleanName) {
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

          createdAt:
            serverTimestamp()

        }
      );

      setNewEmployeeName("");
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


      {/* SHIFT EDITOR */}

      {showEditor && (

        <ShiftEditor
          shift={selectedShift}
          date={editorDate}
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
                      !newEmployeeName.trim()
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
    reason
  }) => {

    await onCreateDayOff({
      shift,
      requestType,
      newStart,
      newEnd,
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
  shifts
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



// ============================================================
// SHIFT EDITOR
// ============================================================

function ShiftEditor({
  shift,
  date,
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
      shift?.department || "Bar"
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

            <select
              value={department}
              onChange={(event) =>
                setDepartment(
                  event.target.value
                )
              }
            >

              <option>
                Bar
              </option>

              <option>
                Sala
              </option>

              <option>
                Pattini
              </option>

              <option>
                Ricevimento
              </option>

            </select>

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