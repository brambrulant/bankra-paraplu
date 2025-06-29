import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Wifi, WifiOff, Info } from 'lucide-react';

interface ConnectionStatusProps {
  midiConnected: boolean;
  artnetConnected: boolean;
  error: string;
}

const ConnectionStatus: React.FC<ConnectionStatusProps> = ({
  midiConnected,
  artnetConnected,
  error
}) => {
  return (
    <Card className="bg-white/5 backdrop-blur-sm border-white/10">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Info className="h-5 w-5 text-blue-400" />
          Connection Status
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-center gap-3 p-3 bg-white/5 rounded-lg border border-white/10">
            <Badge 
              variant={midiConnected ? "default" : "secondary"}
              className={midiConnected ? "bg-green-500 hover:bg-green-600" : "bg-gray-500"}
            >
              {midiConnected ? (
                <Wifi className="h-3 w-3 mr-1" />
              ) : (
                <WifiOff className="h-3 w-3 mr-1" />
              )}
              MIDI Controller
            </Badge>
          </div>
          
          <div className="flex items-center gap-3 p-3 bg-white/5 rounded-lg border border-white/10">
            <Badge 
              variant={artnetConnected ? "default" : "secondary"}
              className={artnetConnected ? "bg-green-500 hover:bg-green-600" : "bg-gray-500"}
            >
              {artnetConnected ? (
                <Wifi className="h-3 w-3 mr-1" />
              ) : (
                <WifiOff className="h-3 w-3 mr-1" />
              )}
              WLED Art-Net
            </Badge>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
            <AlertTriangle className="h-5 w-5 text-red-400 flex-shrink-0" />
            <span className="text-red-300">{error}</span>
          </div>
        )}

        <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
          <h4 className="font-medium text-blue-300 mb-3">How to use:</h4>
          <ul className="space-y-2 text-sm text-gray-300">
            <li className="flex items-start gap-2">
              <span className="w-2 h-2 bg-blue-400 rounded-full mt-2 flex-shrink-0"></span>
              Connect your APC Mini MK2 via USB
            </li>
            <li className="flex items-start gap-2">
              <span className="w-2 h-2 bg-blue-400 rounded-full mt-2 flex-shrink-0"></span>
              Configure WLED with Art-Net enabled (Sync Settings → E1.31/Art-Net → DMX type: Effect)
            </li>
            <li className="flex items-start gap-2">
              <span className="w-2 h-2 bg-blue-400 rounded-full mt-2 flex-shrink-0"></span>
              Enter your WLED IP address and connect via Art-Net
            </li>
            <li className="flex items-start gap-2">
              <span className="w-2 h-2 bg-blue-400 rounded-full mt-2 flex-shrink-0"></span>
              Use the first 3 columns of pads to control different colors for all LEDs
            </li>
            <li className="flex items-start gap-2">
              <span className="w-2 h-2 bg-blue-400 rounded-full mt-2 flex-shrink-0"></span>
              Use the first fader to control overall brightness (affects all LEDs)
            </li>
            <li className="flex items-start gap-2">
              <span className="w-2 h-2 bg-blue-400 rounded-full mt-2 flex-shrink-0"></span>
              Use faders 2 & 3 to adjust color intensity
            </li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};

export default ConnectionStatus; 