import React, { useState } from 'react';

/**
 * Session key creation modal component.
 * @param {Object} props
 * @param {Function} props.onCreate - Handler for creating the session key.
 * @param {Function} props.onClose - Handler for closing the modal.
 * @param {boolean} props.isLoading - Loading state.
 */
const SessionKeyModal = ({ onCreate, onClose, isLoading = false }) => {
  const [duration, setDuration] = useState(30); // Default 30 minutes
  
  // Handler for session key creation.
  const handleCreate = () => {
    if (onCreate) {
      onCreate(duration * 60); // Convert minutes to seconds.
    }
  };

  // Preset durations.
  const presetDurations = [
    { label: '15 minutes', value: 15 },
    { label: '30 minutes', value: 30 },
    { label: '1 hour', value: 60 },
    { label: '2 hours', value: 120 },
    { label: '4 hours', value: 240 }
  ];

  return (
    <div className="modal-overlay">
      <div className="session-key-modal">
        <div className="modal-header">
          <h2>Enable Quick Play</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>
        
        <div className="modal-content">
          <div className="info-section">
            <div className="info-icon">🔑</div>
            <h3>Session Keys</h3>
            <p>
              Enable Quick Play to make multiple transactions without repeatedly confirming in your wallet.
              This creates a temporary session key that can perform lottery transactions on your behalf.
            </p>
          </div>

          <div className="duration-section">
            <label>Session Duration:</label>
            <div className="duration-input">
              <input
                type="number"
                min="1"
                max="1440"
                value={duration}
                onChange={(e) => {
                  const value = parseInt(e.target.value, 10);
                  if (!isNaN(value) && value > 0) {
                    setDuration(value);
                  }
                }}
              />
              <span className="input-suffix">minutes</span>
            </div>
            
            <div className="preset-durations">
              {presetDurations.map((preset) => (
                <button
                  key={preset.value}
                  className={`preset-button ${duration === preset.value ? 'active' : ''}`}
                  onClick={() => setDuration(preset.value)}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          <div className="security-note">
            <div className="note-icon">🔒</div>
            <div className="note-text">
              <strong>Security Note:</strong> Session keys are temporary and limited in scope.
              They can only perform lottery transactions and will expire automatically.
              You can revoke a session key at any time.
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button 
            className="cancel-button"
            onClick={onClose}
            disabled={isLoading}
          >
            Cancel
          </button>
          <button 
            className="create-button"
            onClick={handleCreate}
            disabled={isLoading || !duration}
          >
            {isLoading ? 'Creating...' : 'Create Session Key'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SessionKeyModal;