import type { ReactNode } from 'react'
import { Navigate, NavLink, Outlet, Route, Routes, useNavigate } from 'react-router-dom'
import App from './App'
// import { Footer } from './components/Footer.tsx'
import { Navbar } from './components/Navbar'
import { About } from './pages/About'
import { BlogList } from './pages/BlogList.tsx'
import { BlogPost } from './pages/BlogPost.tsx'
import { Contact } from './pages/Contact.tsx'
import { Experience } from './pages/Experience.tsx'
import { Home } from './pages/Home'
import { Projects } from './pages/Projects'
import { Dashboard } from './admin/Dashboard'
import { Editor } from './admin/Editor'
import { Login } from './admin/Login'
import { Setup } from './admin/Setup'
import { Account } from './admin/Account'

function hasAdminToken(): boolean {
  return Boolean(localStorage.getItem('jp_admin_token'))
}

function ProtectedRoute({ children }: { children: ReactNode }) {
  if (!hasAdminToken()) {
    return <Navigate to="/admin" replace />
  }

  return <>{children}</>
}

function GuiLayout() {
  return (
    <div className="gui-shell">
      <Navbar />
      <main className="gui-content">
        <Outlet />
      </main>
      {/* <Footer /> */}
    </div>
  )
}

function AdminLayout({ children }: { children: ReactNode }) {
  const navigate = useNavigate()

  return (
    <div className="admin-shell">
      <header className="admin-header">
        <h1>Admin</h1>
        <nav>
          <NavLink to="/admin/dashboard">Dashboard</NavLink>
          <NavLink to="/admin/editor">New Post</NavLink>
          <NavLink to="/admin/account">Account</NavLink>
        </nav>
        <button
          type="button"
          onClick={() => {
            localStorage.removeItem('jp_admin_token')
            navigate('/admin')
          }}
        >
          Logout
        </button>
      </header>
      <main className="admin-content">{children}</main>
    </div>
  )
}

export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<App />} />

      <Route path="/gui" element={<GuiLayout />}>
        <Route index element={<Home />} />
        <Route path="about" element={<About />} />
        <Route path="projects" element={<Projects />} />
        <Route path="experience" element={<Experience />} />
        <Route path="blog" element={<BlogList />} />
        <Route path="blog/:slug" element={<BlogPost />} />
        <Route path="contact" element={<Contact />} />
      </Route>

      <Route path="/admin" element={<Login />} />
      <Route path="/admin/setup" element={<Setup />} />
      <Route
        path="/admin/dashboard"
        element={
          <ProtectedRoute>
            <AdminLayout>
              <Dashboard />
            </AdminLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/editor"
        element={
          <ProtectedRoute>
            <AdminLayout>
              <Editor />
            </AdminLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/account"
        element={
          <ProtectedRoute>
            <AdminLayout>
              <Account />
            </AdminLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/edit/:id"
        element={
          <ProtectedRoute>
            <AdminLayout>
              <Editor />
            </AdminLayout>
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
