// src/components/settings/StorageSecuritySelector.tsx
import React, { useState } from 'react';
import { AlertTriangle, Shield, ShieldAlert, ShieldOff, Info, Check } from 'lucide-react';
import type { StoragePreference, StorageType, SecurityWarning } from '@/types/storage';
import { SECURITY_WARNINGS } from '@/types/storage';

interface StorageSecuritySelectorProps {
  currentPreference: StoragePreference;
  onPreferenceChange: (preference: StoragePreference) => void;
  className?: string;
}

/**
 * Security settings component for API key storage with three-tier model
 */
export const StorageSecuritySelector: React.FC<StorageSecuritySelectorProps> = ({
  currentPreference,
  onPreferenceChange,
  className = '',
}) => {
  const [showDetails, setShowDetails] = useState<StorageType | null>(null);

  const getSecurityIcon = (level: SecurityWarning['level']) => {
    switch (level) {
      case 'low':
        return <Shield className="h-5 w-5 text-green-500" />;
      case 'medium':
        return <ShieldAlert className="h-5 w-5 text-orange-500" />;
      case 'high':
        return <ShieldOff className="h-5 w-5 text-red-500" />;
    }
  };

  const getSecurityColor = (level: SecurityWarning['level']) => {
    switch (level) {
      case 'low':
        return 'border-green-200 bg-green-50';
      case 'medium':
        return 'border-orange-200 bg-orange-50';
      case 'high':
        return 'border-red-200 bg-red-50';
    }
  };

  const handleStorageTypeChange = (type: StorageType) => {
    onPreferenceChange({
      type,
      acknowledgedRisks: type === 'none' ? true : false, // No risks for memory-only storage
    });
  };

  const handleRiskAcknowledgment = (acknowledged: boolean) => {
    onPreferenceChange({
      ...currentPreference,
      acknowledgedRisks: acknowledged,
    });
  };

  return (
    <div className={`space-y-6 ${className}`}>
      <div className="space-y-2">
        <h3 className="text-lg font-semibold flex items-center space-x-2">
          <Shield className="h-5 w-5" />
          <span>API Key Storage Security</span>
        </h3>
        <p className="text-sm text-muted-foreground">
          Choose how your API keys are stored. Each option has different security implications.
        </p>
      </div>

      {/* Storage Options */}
      <div className="space-y-4">
        {Object.entries(SECURITY_WARNINGS).map(([type, warning]) => {
          const storageType = type as StorageType;
          const isSelected = currentPreference.type === storageType;
          const isExpanded = showDetails === storageType;

          return (
            <div
              key={storageType}
              className={`border rounded-lg transition-all ${
                isSelected 
                  ? `${getSecurityColor(warning.level)} border-2` 
                  : 'border-border hover:border-muted-foreground'
              }`}
            >
              {/* Option Header */}
              <div className="p-4">
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 mt-0.5">
                    <input
                      type="radio"
                      id={storageType}
                      name="storageType"
                      checked={isSelected}
                      onChange={() => handleStorageTypeChange(storageType)}
                      className="h-4 w-4 text-primary focus:ring-primary border-gray-300"
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <label
                        htmlFor={storageType}
                        className="flex items-center space-x-2 cursor-pointer"
                      >
                        {getSecurityIcon(warning.level)}
                        <span className="font-medium">{warning.title}</span>
                      </label>

                      <button
                        onClick={() => setShowDetails(isExpanded ? null : storageType)}
                        className="p-1 hover:bg-muted rounded transition-colors"
                        title="Show details"
                      >
                        <Info className="h-4 w-4 text-muted-foreground" />
                      </button>
                    </div>

                    <p className="text-sm text-muted-foreground mt-1">
                      {warning.description}
                    </p>

                    {warning.recommendation && (
                      <p className="text-sm text-blue-600 mt-1 font-medium">
                        {warning.recommendation}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Expanded Details */}
              {isExpanded && (
                <div className="px-4 pb-4 border-t bg-muted/20">
                  <div className="pt-4 space-y-3">
                    <div>
                      <h4 className="text-sm font-medium mb-2 flex items-center space-x-1">
                        <AlertTriangle className="h-4 w-4 text-orange-500" />
                        <span>Security Risks</span>
                      </h4>
                      <ul className="text-sm space-y-1">
                        {warning.risks.map((risk, index) => (
                          <li key={index} className="flex items-start space-x-2">
                            <span className="text-orange-500 mt-0.5">•</span>
                            <span>{risk}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {storageType === 'none' && (
                      <div className="p-3 bg-green-50 border border-green-200 rounded">
                        <div className="flex items-start space-x-2">
                          <Check className="h-4 w-4 text-green-600 mt-0.5" />
                          <div className="text-sm">
                            <p className="font-medium text-green-800">Most Secure Option</p>
                            <p className="text-green-700">
                              Your API key will only exist in memory and will be lost when you refresh 
                              the page or close the tab. This provides maximum security but requires 
                              re-entering your key each session.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {storageType === 'session' && (
                      <div className="p-3 bg-blue-50 border border-blue-200 rounded">
                        <div className="flex items-start space-x-2">
                          <Info className="h-4 w-4 text-blue-600 mt-0.5" />
                          <div className="text-sm">
                            <p className="font-medium text-blue-800">Recommended Balance</p>
                            <p className="text-blue-700">
                              Your API key will persist for the current browser session but will be 
                              cleared when you close the tab. This provides a good balance between 
                              security and convenience.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {storageType === 'local' && (
                      <div className="p-3 bg-red-50 border border-red-200 rounded">
                        <div className="flex items-start space-x-2">
                          <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5" />
                          <div className="text-sm">
                            <p className="font-medium text-red-800">Highest Risk</p>
                            <p className="text-red-700">
                              Your API key will be stored permanently in your browser until manually 
                              cleared. Only use this option if you understand the risks and have 
                              strict spending limits on your API account.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Risk Acknowledgment */}
      {currentPreference.type !== 'none' && (
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <h4 className="font-medium text-yellow-800 mb-2">
                Security Acknowledgment Required
              </h4>
              <p className="text-sm text-yellow-700 mb-3">
                By selecting this storage option, you acknowledge the security risks outlined above. 
                Please ensure you understand the implications before proceeding.
              </p>
              
              <label className="flex items-start space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={currentPreference.acknowledgedRisks}
                  onChange={(e) => handleRiskAcknowledgment(e.target.checked)}
                  className="mt-0.5 h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                />
                <span className="text-sm text-yellow-800">
                  I understand and accept the security risks associated with{' '}
                  <strong>
                    {SECURITY_WARNINGS[currentPreference.type].title.toLowerCase()}
                  </strong>
                </span>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Current Status */}
      <div className="p-4 bg-muted/30 rounded-lg">
        <h4 className="font-medium mb-2">Current Configuration</h4>
        <div className="flex items-center space-x-2 text-sm">
          {getSecurityIcon(SECURITY_WARNINGS[currentPreference.type].level)}
          <span>
            <strong>{SECURITY_WARNINGS[currentPreference.type].title}</strong>
          </span>
          {currentPreference.acknowledgedRisks && currentPreference.type !== 'none' && (
            <span className="text-green-600">(Risks Acknowledged)</span>
          )}
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          {SECURITY_WARNINGS[currentPreference.type].description}
        </p>
      </div>
    </div>
  );
};

export default StorageSecuritySelector;