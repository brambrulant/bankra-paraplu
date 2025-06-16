import React from "react";
import { Badge } from "@/components/ui/badge";
import { Activity, Clock, Hash } from "lucide-react";

interface MIDIEvent {
  status: number;
  note: number;
  velocity: number;
  deltaTime: number;
  timestamp: number;
}

interface MIDIEventLogProps {
  events: MIDIEvent[];
}

const MIDIEventLog: React.FC<MIDIEventLogProps> = ({ events }) => {
  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
  };

  const getEventType = (status: number) => {
    switch (status) {
      case 0x90:
        return "Note On";
      case 0x80:
        return "Note Off";
      case 0xb0:
        return "Control Change";
      default:
      // return `Unknown (0x${status.toString(16).toUpperCase()})`;
    }
  };

  const getEventDescription = (event: MIDIEvent) => {
    console.log("Event:", event);
    const type = getEventType(event.status);

    if (event.status === 0x90 && event.velocity > 0) {
      // Note On - Pad press
      return `${type} - Pad ${event.note} (Velocity: ${event.velocity})`;
    } else if (event.status === 0xb0) {
      // Control Change - Fader
      return `${type} - Fader ${event.note} (Value: ${event.velocity})`;
    } else {
      return `${type} - Note: ${event.note}, Velocity: ${event.velocity}`;
    }
  };

  const getEventColor = (status: number) => {
    switch (status) {
      case 0x90:
        return "bg-green-500/20 text-green-300 border-green-500/30";
      case 0x80:
        return "bg-gray-500/20 text-gray-300 border-gray-500/30";
      case 0xb0:
        return "bg-blue-500/20 text-blue-300 border-blue-500/30";
      default:
        return "bg-yellow-500/20 text-yellow-300 border-yellow-500/30";
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-green-400" />
          <h3 className="text-lg font-medium">MIDI Events (Last 50)</h3>
        </div>
        <Badge variant="outline" className="text-xs">
          {events.length} events
        </Badge>
      </div>

      <div className="max-h-80 overflow-y-auto border border-white/10 rounded-lg bg-black/20">
        {events.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-sm">
              No MIDI events yet. Try pressing a pad or moving a fader.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-white/10">
            {events.map((event, index) => (
              <div
                key={index}
                className="p-4 hover:bg-white/5 transition-colors"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      <Clock className="h-3 w-3" />
                      {formatTimestamp(event.timestamp)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge
                          variant="outline"
                          className={`text-xs ${getEventColor(event.status)}`}
                        >
                          {getEventType(event.status)}
                        </Badge>
                      </div>
                      <div className="text-sm text-white truncate">
                        {getEventDescription(event)}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-gray-500 font-mono">
                    <Hash className="h-3 w-3" />
                    {event.note} {event.velocity}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MIDIEventLog;
