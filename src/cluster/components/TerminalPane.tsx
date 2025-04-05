import { useState, useRef, useEffect } from 'react';

interface TerminalPaneProps {
  selectedContext: string | null;
}

/**
 * Terminal pane component
 */
function TerminalPane({ selectedContext }: TerminalPaneProps) {
  const [terminalOutput, setTerminalOutput] = useState<string[]>([
    'Terminal session started',
    'You can run commands here...',
  ]);
  const [inputCommand, setInputCommand] = useState('');
  const terminalContentRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when terminal output updates
  useEffect(() => {
    if (terminalContentRef.current) {
      terminalContentRef.current.scrollTop = terminalContentRef.current.scrollHeight;
    }
  }, [terminalOutput]);

  // Command submission handler (mock implementation)
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputCommand.trim()) return;

    // Add the executed command to output
    const newOutput = [...terminalOutput, `$ ${inputCommand}`];

    // Mock response based on selected context
    if (selectedContext) {
      if (inputCommand.includes('kubectl')) {
        newOutput.push(`Context: ${selectedContext}`);

        if (inputCommand.includes('get pods')) {
          newOutput.push('NAME                     READY   STATUS    RESTARTS   AGE');
          newOutput.push('app-deployment-1-xyzabc   1/1     Running   0          3d2h');
          newOutput.push('app-deployment-2-abcdef   1/1     Running   0          2d5h');
        } else if (inputCommand.includes('get nodes')) {
          newOutput.push('NAME          STATUS   ROLES    AGE     VERSION');
          newOutput.push('node-1        Ready    master   90d     v1.25.0');
          newOutput.push('node-2        Ready    <none>   90d     v1.25.0');
        } else {
          newOutput.push('Command executed successfully');
        }
      } else {
        newOutput.push('> Command executed');
      }
    } else {
      newOutput.push('Error: No Kubernetes context selected');
    }

    setTerminalOutput(newOutput);
    setInputCommand('');
  };

  return (
    <div className="terminal-container">
      <div className="terminal-header">
        <span>Terminal</span>
        <span>{selectedContext ? `Context: ${selectedContext}` : 'No context selected'}</span>
      </div>
      <div className="terminal-content" ref={terminalContentRef}>
        {terminalOutput.map((line, index) => (
          <div key={index} className="terminal-line">
            {line}
          </div>
        ))}
      </div>
      <form onSubmit={handleSubmit} className="terminal-input-form">
        <div className="terminal-input-wrapper">
          <span className="terminal-prompt">$ </span>
          <input
            type="text"
            value={inputCommand}
            onChange={e => setInputCommand(e.target.value)}
            className="terminal-input"
            placeholder="Enter command..."
          />
        </div>
      </form>
    </div>
  );
}

export default TerminalPane;
