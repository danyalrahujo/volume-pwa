import { useEffect, useMemo, useState } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut
} from "firebase/auth";

import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp
} from "firebase/firestore";

import { auth, db } from "./firebase";


// ============================================================
// HELPERS
// ============================================================

function startOfDay(date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function sameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
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

function dateKey(date) {
  return `${date.getFullYear()}-${String(
    date.getMonth() + 1
  ).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;
}


// ============================================================
// APP
// ============================================================

function App() {

  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);

  const [employees, setEmployees] = useState([]);
  const [shifts, setShifts] = useState([]);

  const [loading, setLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState("");

  const [month, setMonth] = useState(
    new Date()
  );

  const [selectedShift, setSelectedShift] =
    useState(null);

  const [showEditor, setShowEditor] =
    useState(false);

  const [editorDate, setEditorDate] =
    useState(new Date());


  // ==========================================================
  // AUTH
  // ==========================================================

  useEffect(() => {

    const unsubscribe =
      onAuthStateChanged(
        auth,
        async (currentUser) => {

          setUser(currentUser);

          if (!currentUser) {

            setProfile(null);
            setEmployees([]);
            setShifts([]);
            setLoading(false);

            return;
          }

          try {

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

                  } else {

                    setProfile(null);
                    setError(
                      "Your VOLUME profile was not found."
                    );
                  }

                  setLoading(false);
                },
                (err) => {

                  console.error(err);

                  setError(
                    "Could not load your VOLUME profile."
                  );

                  setLoading(false);
                }
              );

            return () => {
              unsubscribeProfile();
            };

          } catch (err) {

            console.error(err);

            setError(
              "Could not load your VOLUME profile."
            );

            setLoading(false);
          }
        }
      );

    return () => unsubscribe();

  }, []);


  // ==========================================================
  // FIRESTORE EMPLOYEES
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
  // FIRESTORE SHIFTS
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

    } catch (err) {

      console.error(err);
    }
  }


  // ==========================================================
  // ADD SHIFT
  // ==========================================================

  function openAddShift(date) {

    setSelectedShift(null);
    setEditorDate(date);
    setShowEditor(true);
  }


  // ==========================================================
  // EDIT SHIFT
  // ==========================================================

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
      selectedShift?.id
      || crypto.randomUUID();

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
  // LOGIN SCREEN
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


      {/* MAIN */}

      <main className="main-content">

        {/* MONTH HEADER */}

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


        {/* TIMETABLE */}

        <div className="table-wrapper">

          <div className="timetable">

            {/* HEADER */}

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
                    key={dateKey(date)}
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


            {/* EMPLOYEES */}

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
                            key={dateKey(date)}
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


        {/* MOBILE / GENERAL INFORMATION */}

        <div className="info-row">

          <span>
            {employees.length} employee
            {employees.length !== 1
              ? "s"
              : ""}
          </span>

          <span>
            {shifts.filter(
              (shift) => {

                return (
                  shift.date.getMonth() ===
                    month.getMonth() &&
                  shift.date.getFullYear() ===
                    month.getFullYear()
                );
              }
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

          {/* EMPLOYEE */}

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


          {/* DATE */}

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


          {/* DEPARTMENT */}

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


          {/* START */}

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


          {/* END */}

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


          {/* DURATION */}

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


          {/* ACTIONS */}

          <div className="form-actions">

            {shift && (

              <button
                className="delete-button"
                onClick={() =>
                  onDelete(shift)
                }
              >
                Delete Shift
              </button>

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
                disabled={
                  !employeeID
                }
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


// ============================================================
// DATE INPUT
// ============================================================

function formatDateInput(date) {

  const year =
    date.getFullYear();

  const month =
    String(
      date.getMonth() + 1
    ).padStart(2, "0");

  const day =
    String(
      date.getDate()
    ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}


export default App;