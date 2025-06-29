// wled selector component

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Wifi, WifiOff, Zap, Globe } from "lucide-react";

interface WLEDSelectorProps {
  onRefresh: () => void;
  connected: boolean;
  onArtnetConnect?: (host: string, universe: number) => void;
  artnetConnected?: boolean;
  onTestArtnet?: () => void;
}

const WLEDSelector: React.FC<WLEDSelectorProps> = ({
  onRefresh,
  connected,
  onArtnetConnect,
  artnetConnected = false,
  onTestArtnet,
}) => {
  const [artnetHost, setArtnetHost] = useState("192.168.0.100");
  const [artnetUniverse, setArtnetUniverse] = useState(1);

  const handleArtnetConnect = () => {
    if (onArtnetConnect) {
      onArtnetConnect(artnetHost, artnetUniverse);
    }
  };

  return (
    <Card className="bg-white/5 backdrop-blur-sm border-white/10">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg font-medium">
            <Zap className="h-5 w-5 text-yellow-400" />
            WLED Art-Net Control
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={onRefresh}
              className="text-gray-300 hover:text-white"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Badge
              variant={connected || artnetConnected ? "default" : "secondary"}
              className={
                connected || artnetConnected ? "bg-green-500 hover:bg-green-600" : "bg-gray-500"
              }
            >
              {connected || artnetConnected ? (
                <Wifi className="h-3 w-3 mr-1" />
              ) : (
                <WifiOff className="h-3 w-3 mr-1" />
              )}
              {connected || artnetConnected ? "Connected" : "Disconnected"}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Art-Net Connection */}
        <div>
          <div className="font-semibold text-xs text-gray-400 mb-2 flex items-center gap-2">
            <Globe className="h-3 w-3" />
            Art-Net Connection
          </div>
          <div className="space-y-3">
            <div className="flex gap-2">
              <input
                type="text"
                value={artnetHost}
                onChange={(e) => setArtnetHost(e.target.value)}
                placeholder="WLED IP Address"
                className="flex-1 px-3 py-2 bg-black/20 border border-white/10 rounded text-white text-sm"
              />
              <input
                type="number"
                value={artnetUniverse}
                onChange={(e) => setArtnetUniverse(parseInt(e.target.value) || 1)}
                placeholder="Universe"
                min="1"
                max="255"
                className="w-20 px-3 py-2 bg-black/20 border border-white/10 rounded text-white text-sm"
              />
            </div>
            <Button
              onClick={handleArtnetConnect}
              disabled={artnetConnected}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
            >
              {artnetConnected ? "Art-Net Connected" : "Connect Art-Net"}
            </Button>
            
            {artnetConnected && (
              <Button
                onClick={onTestArtnet}
                className="w-full bg-green-600 hover:bg-green-700 text-white"
              >
                Test Art-Net
              </Button>
            )}
          </div>
        </div>

        {/* Connection Info */}
        {artnetConnected && (
          <div className="text-xs text-gray-400 space-y-1">
            <div>Connected to: {artnetHost}</div>
            <div>Universe: {artnetUniverse}</div>
            <div>Protocol: Art-Net Effect Mode</div>
            <div>Channels: 15 (Master, Effect, Speed, Intensity, Colors)</div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default WLEDSelector;
