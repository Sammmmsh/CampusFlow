import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { useSelector } from "react-redux";
import Homepage from "./pages/Homepage";
import AdminDashboard from "./pages/admin/AdminDashboard";
import StudentDashboard from "./pages/student/StudentDashboard";
import TeacherDashboard from "./pages/teacher/TeacherDashboard";
import LoginPage from "./pages/LoginPage";
import AdminRegisterPage from "./pages/admin/AdminRegisterPage";
import ChooseUser from "./pages/ChooseUser";
import Operations from "./ops/Operations";
import AccountPage from "./ops/AccountPage";

const LegacyApp = () => {
  const { currentRole } = useSelector((state) => state.user);

  return (
    <>
      {currentRole === null && (
        <Routes>
          <Route path="/" element={<Homepage />} />
          <Route path="/choose" element={<ChooseUser visitor="normal" />} />
          <Route
            path="/chooseasguest"
            element={<ChooseUser visitor="guest" />}
          />

          <Route
            path="/Adminlogin"
            element={
              process.env.REACT_APP_BASE_URL ? (
                <LoginPage role="Admin" />
              ) : (
                <Navigate to="/choose" replace />
              )
            }
          />
          <Route
            path="/Studentlogin"
            element={
              process.env.REACT_APP_BASE_URL ? (
                <LoginPage role="Student" />
              ) : (
                <Navigate to="/choose" replace />
              )
            }
          />
          <Route
            path="/Teacherlogin"
            element={
              process.env.REACT_APP_BASE_URL ? (
                <LoginPage role="Teacher" />
              ) : (
                <Navigate to="/choose" replace />
              )
            }
          />

          <Route
            path="/Adminregister"
            element={
              process.env.REACT_APP_BASE_URL ? (
                <AdminRegisterPage />
              ) : (
                <Navigate to="/choose" replace />
              )
            }
          />

          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      )}

      {currentRole === "Admin" && (
        <>
          <AdminDashboard />
        </>
      )}

      {currentRole === "Student" && (
        <>
          <StudentDashboard />
        </>
      )}

      {currentRole === "Teacher" && (
        <>
          <TeacherDashboard />
        </>
      )}
    </>
  );
};

const App = () => (
  <Router>
    <Routes>
      <Route path="/ops/sign-in" element={<AccountPage />} />
      <Route path="/ops/*" element={<Operations />} />
      <Route path="*" element={<LegacyApp />} />
    </Routes>
  </Router>
);
export default App;
