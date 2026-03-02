import { useState } from 'react';

interface AutoRemindersToggleProps {
  eventId: string;
  initialValue?: boolean;
}

export function AutoRemindersToggle({ eventId, initialValue = false }: AutoRemindersToggleProps) {
  const [enabled, setEnabled] = useState(initialValue);

  const handleToggle = async () => {
    // TODO: Implement actual toggle logic
    const newValue = !enabled;
    setEnabled(newValue);
    console.log(`Auto reminders for event ${eventId} set to: ${newValue}`);
  };

  return (
    <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg bg-white">
      <div>
        <h3 className="text-sm font-medium text-gray-900">Automatic Reminders</h3>
        <p className="text-sm text-gray-500 mt-1">
          Send automatic reminders to guests before the event
        </p>
      </div>
      <button
        type="button"
        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2 ${
          enabled ? 'bg-indigo-600' : 'bg-gray-200'
        }`}
        role="switch"
        aria-checked={enabled}
        onClick={handleToggle}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
            enabled ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
}
