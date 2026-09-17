import { Routes, Route, useLocation } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { useStore } from '@/data/store';
import { Toasts } from '@/components/Toasts';
import { CommandCentre } from '@/views/CommandCentre';
import { Engagements, EngagementDetail } from '@/views/Engagements';
import { Findings, FindingDetail } from '@/views/Findings';
import { Intake } from '@/views/Intake';
import { Simulator } from '@/views/Simulator';
import { Assets } from '@/views/Assets';
import { Timeline } from '@/views/Timeline';
import { TasksView } from '@/views/Tasks';
import { SocMonitor } from '@/views/Soc';
import { Builds } from '@/views/Builds';
import { Reports, ReportDetail } from '@/views/Reports';
import { Team } from '@/views/Team';
import { Present } from '@/views/Present';

export function App() {
  const loc = useLocation();
  // Presentation mode takes over the full screen — render it outside the Layout.
  if (loc.pathname === '/present') return (<><Present /><Toasts /></>);
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<CommandCentre />} />
        <Route path="/engagements" element={<Engagements />} />
        <Route path="/engagements/:id" element={<EngagementDetail />} />
        <Route path="/findings" element={<Findings />} />
        <Route path="/findings/:id" element={<FindingDetail />} />
        <Route path="/intake" element={<Intake />} />
        <Route path="/simulator" element={<Simulator />} />
        <Route path="/assets" element={<Assets />} />
        <Route path="/timeline" element={<Timeline />} />
        <Route path="/tasks" element={<TasksView />} />
        <Route path="/soc" element={<SocMonitor />} />
        <Route path="/builds" element={<Builds />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/reports/:id" element={<ReportDetail />} />
        <Route path="/team" element={<Team />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      <Toasts />
    </Layout>
  );
}

function NotFound() {
  return <div className="page"><div className="empty"><div className="empty__title">Page not found</div><a href="/">Back to command centre</a></div></div>;
}

// re-export so store toasts show everywhere
export function _keep() { useStore(); }
