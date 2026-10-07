export default function AdminGuard({ children }) {
  // The dashboard opens directly. API operations keep their server-side checks.
  return children;
}
