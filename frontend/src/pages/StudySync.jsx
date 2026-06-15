import { useState } from "react";
import Sidebar from "@/components/studysync/Sidebar";
import Dashboard from "@/components/studysync/Dashboard";
import Tasks from "@/components/studysync/Tasks";
import Resources from "@/components/studysync/Resources";
import Groups from "@/components/studysync/Groups";
import GMeet from "@/components/studysync/GMeet";
import AITutor from "@/components/studysync/AITutor";
import Settings from "@/components/studysync/Settings";
import Pomodoro from "@/components/studysync/Pomodoro";
import CalendarView from "@/components/studysync/CalendarView";
import PremiumModal from "@/components/studysync/PremiumModal";
import GroupChat from "@/components/studysync/GroupChat";

export default function StudySync() {
  const [section, setSection] = useState("dashboard");
  const [premiumOpen, setPremiumOpen] = useState(false);
  const [chatGroup, setChatGroup] = useState(null);

  return (
    <div className="app-shell" data-testid="studysync-app">
      <Sidebar section={section} onChange={setSection} onUpgrade={() => setPremiumOpen(true)} />
      <main className="main fade-in" key={section}>
        {section === "dashboard" && <Dashboard onJump={setSection} onUpgrade={() => setPremiumOpen(true)} />}
        {section === "tasks" && <Tasks />}
        {section === "calendar" && <CalendarView />}
        {section === "pomodoro" && <Pomodoro />}
        {section === "resources" && <Resources onUpgrade={() => setPremiumOpen(true)} />}
        {section === "groups" && <Groups onOpenChat={setChatGroup} />}
        {section === "meet" && <GMeet />}
        {section === "tutor" && <AITutor onUpgrade={() => setPremiumOpen(true)} />}
        {section === "settings" && <Settings onUpgrade={() => setPremiumOpen(true)} />}
        <div className="app-foot">© 2026 · Developed by <strong>Team MARS</strong> · StudySync</div>
      </main>

      {premiumOpen && <PremiumModal onClose={() => setPremiumOpen(false)} />}
      {chatGroup && <GroupChat group={chatGroup} onClose={() => setChatGroup(null)} />}
    </div>
  );
}
