// src/components/settings/StorageSecuritySelector.tsx
import React, { useState } from 'react';
import { AlertTriangle, Shield, ShieldAlert, ShieldOff, Info, Check } from 'lucide-react';
import type { StoragePreference, StorageType, SecurityWarning } from '@/types/storage';
import { SECURITY_WARNINGS } from '@/types/storage';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';

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
        return 'border-green-500/20 bg-accent text-accent-foreground';
      case 'medium':
        return 'border-orange-500/20 bg-accent text-accent-foreground';
      case 'high':
        return 'border-red-500/20 bg-accent text-accent-foreground';
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
      <RadioGroup
        value={currentPreference.type}
        onValueChange={(value) => handleStorageTypeChange(value as StorageType)}
        className="space-y-4"
      >
        {Object.entries(SECURITY_WARNINGS).map(([type, warning]) => {
          const storageType = type as StorageType;
          const isSelected = currentPreference.type === storageType;
          const isExpanded = showDetails === storageType;

          return (
            <div
              key={storageType}
              className={`border rounded-lg transition-all cursor-pointer ${
                isSelected
                  ? `${getSecurityColor(warning.level)} border-2`
                  : 'border-border hover:border-muted-foreground'
              }`}
              onClick={() => handleStorageTypeChange(storageType)}
            >
              {/* Option Header */}
              <div className="p-4">
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 mt-0.5">
                    <RadioGroupItem
                      value={storageType}
                      id={storageType}
                      className="pointer-events-none"
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        {getSecurityIcon(warning.level)}
                        <span className="font-medium">{warning.title}</span>
                      </div>

                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowDetails(isExpanded ? null : storageType);
                        }}
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        title="Show details"
                      >
                        <Info className="h-4 w-4" />
                      </Button>
                    </div>

                    <p className="text-sm text-muted-foreground mt-1">
                      {warning.description}
                    </p>

                    {warning.recommendation && (
                      <p className="text-sm text-primary mt-1 font-medium">
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
                      <Alert className="border-green-200 bg-green-50">
                        <Check className="h-4 w-4 text-green-600" />
                        <AlertDescription>
                          <p className="font-medium text-green-800">Most Secure Option</p>
                          <p className="text-green-700 text-sm">
                            Your API key will only exist in memory and will be lost when you refresh
                            the page or close the tab. This provides maximum security but requires
                            re-entering your key each session.
                          </p>
                        </AlertDescription>
                      </Alert>
                    )}

                    {storageType === 'session' && (
                      <Alert className="border-blue-200 bg-blue-50">
                        <Info className="h-4 w-4 text-blue-600" />
                        <AlertDescription>
                          <p className="font-medium text-blue-800">Recommended Balance</p>
                          <p className="text-blue-700 text-sm">
                            Your API key will persist for the current browser session but will be
                            cleared when you close the tab. This provides a good balance between
                            security and convenience.
                          </p>
                        </AlertDescription>
                      </Alert>
                    )}

                    {storageType === 'local' && (
                      <Alert variant="destructive" className="border-red-200 bg-red-50">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>
                          <p className="font-medium">Highest Risk</p>
                          <p className="text-sm">
                            Your API key will be stored permanently in your browser until manually
                            cleared. Only use this option if you understand the risks and have
                            strict spending limits on your API account.
                          </p>
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </RadioGroup>

      {/* Risk Acknowledgment */}
      {currentPreference.type !== 'none' && (
        <Alert className="border-border bg-muted/50 cursor-pointer" onClick={() => handleRiskAcknowledgment(!currentPreference.acknowledgedRisks)}>
          <AlertTriangle className="h-5 w-5 text-muted-foreground" />
          <AlertDescription>
            <h4 className="font-medium text-foreground mb-2">
              Security Acknowledgment Required
            </h4>
            <p className="text-sm text-muted-foreground mb-3">
              By selecting this storage option, you acknowledge the security risks outlined above.
              Please ensure you understand the implications before proceeding.
            </p>
            
            <div className="flex items-start space-x-2">
              <Checkbox
                id="risk-acknowledgment"
                checked={currentPreference.acknowledgedRisks}
                onCheckedChange={handleRiskAcknowledgment}
                className="pointer-events-none"
              />
              <div className="text-sm text-foreground">
                I understand and accept the security risks associated with{' '}
                <strong>
                  {SECURITY_WARNINGS[currentPreference.type].title.toLowerCase()}
                </strong>
              </div>
            </div>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};

export default StorageSecuritySelector;