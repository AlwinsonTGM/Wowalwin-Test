import { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { copy, showConfig } from '../content/show.ts';
import { Backbone } from './Backbone.tsx';
import { Stage } from './Stage.tsx';
import { Player } from './Player.tsx';
import { useShow } from './useShow.ts';
import './styles.css';

function App() {
  const show = useShow();

  useEffect(() => {
    document.title = copy.showTitle;
  }, []);

  if (location.pathname === showConfig.stagePath) return <Stage state={show.state} joinUrl={show.joinUrl} />;

  if (location.pathname === showConfig.playerPath) {
    return (
      <Player
        state={show.state}
        me={show.me}
        refusal={show.refusal}
        complaint={show.complaint}
        connection={show.connection}
        onJoin={show.join}
      />
    );
  }

  return (
    <Backbone state={show.state} joinUrl={show.joinUrl} connection={show.connection} onStartShow={show.startShow} />
  );
}

createRoot(document.getElementById('root') as HTMLElement).render(<App />);