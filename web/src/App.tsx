import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { ConversationsProvider } from "./conversations/context";
import { ChatPage } from "./pages/ChatPage";
import { CommitmentsPage } from "./pages/CommitmentsPage";
import { ConfirmFiguresPage } from "./pages/ConfirmFiguresPage";
import { FirstReadingPage } from "./pages/FirstReadingPage";
import "./styles/app.css";

export default function App() {
  return (
    <ConversationsProvider>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<Navigate to="/cifras" replace />} />
          <Route path="cifras" element={<ConfirmFiguresPage />} />
          <Route path="documentos" element={<Navigate to="/cifras" replace />} />
          <Route path="lectura" element={<FirstReadingPage />} />
          <Route path="chat" element={<ChatPage />} />
          <Route path="chat/:conversationId" element={<ChatPage />} />
          <Route path="compromisos" element={<CommitmentsPage />} />
        </Route>
      </Routes>
    </ConversationsProvider>
  );
}
