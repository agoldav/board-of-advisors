import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { ChatBar } from "./ChatBar";
import { LeftRail } from "./LeftRail";

export function AppShell() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const isChat = pathname.startsWith("/chat");

  return (
    <div className="app-frame">
      <LeftRail />
      <div className="main-column">
        <div className="main-scroll">
          <Outlet />
        </div>
        {!isChat && (
          <ChatBar
            onSend={(text) => {
              navigate("/chat", { state: { pendingQuestion: text } });
            }}
          />
        )}
      </div>
    </div>
  );
}
