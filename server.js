import express from "express";
import cors from "cors";
import { WebSocketServer } from "ws";
import midi from "midi";
import Artnet from "artnet";

const app = express();
const port = 3001;

// --- Middleware ---
app.use(cors());
app.use(express.json());

// --- WebSocket Server ---
const wss = new WebSocketServer({ port: 3002 });

// --- Loading and error state ---
let loading = true;
let error = false;

// --- MIDI Setup ---
let midiInput = new midi.Input();
let midiOutput = new midi.Output();

// --- WLED Art-Net Setup ---
let artnetClient = null;
let wledArtnetConfig = {
  host: '192.168.0.100/', // Updated to your WLED IP
  universe: 1,
  port: 6454
};

let midiDevices = [];

// --- WLED Current State (Persisted across presets) ---
let currentWledState = {
  on: false,
  bri: 255,   // Master brightness (0-255)
  speed: 128, // Effect speed (0-255)
  intensity: 128, // Effect intensity (0-255)
  ps: -1,     // Current preset ID (-1 for no active preset)
  seg: [{ col: [[255, 255, 255]] }], // Default segment color for initial state
};

// MIDI message constants for APC Mini MK2
const MIDI_COMMANDS = {
  NOTE_ON: 0x90,          // Note On message for pad press (10% brightness)
  PAD_SOLID: 0x96,        // Solid color (100% brightness)
  PAD_BLINK_SLOW: 0x9F,   // Blinking 1/2 note
  PAD_BLINK_FAST: 0x9E,   // Blinking 1/4 note
  PAD_PULSE: 0x97,        // Pulsing 1/16 note
};

// --- APC Mini Pad to Preset Mapping ---
const APC_PAD_MAPPING = {
  // Column 1: Mild, Gradient Effects (Reddish -> Orangish -> Yellow/Green -> Cyan/Blue -> Purple/Pink -> White/Rainbow)
  0x38: { presetNum: 1, padColor: 5 },  // #FF0000 (Pure Red for Preset 1)
  0x30: { presetNum: 2, padColor: 9 },  // #FF5400 (Good Orange for Preset 2)
  0x28: { presetNum: 3, padColor: 16 }, // #88FF4C (Bright greenish-yellow for Preset 3)
  0x20: { presetNum: 4, padColor: 36 }, // #4CC3FF (Bright cyan/light blue for Preset 4)
  0x18: { presetNum: 5, padColor: 45 }, // #0000FF (Pure blue for Preset 5)
  0x10: { presetNum: 6, padColor: 49 }, // #5400FF (Vibrant purple for Preset 6)
  0x08: { presetNum: 7, padColor: 53 }, // #FF00FF (Pure magenta for Preset 7)
  0x00: { presetNum: 8, padColor: 114 }, // #80FFBD (A general vibrant aqua/green to represent rainbow for Preset 8)

  // Column 2: More Intense Effects (Reddish -> Orangish -> Yellow/Green -> Cyan/Blue -> Purple/Pink -> White/Rainbow)
  0x39: { presetNum: 9, padColor: 72 },  // #FF0000 (Pure Red for Preset 9)
  0x31: { presetNum: 10, padColor: 96 }, // #FF7F00 (Vibrant Orange for Preset 10)
  0x29: { presetNum: 11, padColor: 13 }, // #FFFF00 (Pure Yellow for Preset 11)
  0x21: { presetNum: 12, padColor: 37 }, // #00A9FF (Good bright blue/cyan for Preset 12)
  0x19: { presetNum: 13, padColor: 41 }, // #0055FF (Medium blue for Preset 13)
  0x11: { presetNum: 14, padColor: 80 }, // #3F00FF (Darker Violet/Purple for Preset 14)
  0x09: { presetNum: 15, padColor: 57 }, // #FF0054 (Bright Pink for Preset 15)
  0x01: { presetNum: 16, padColor: 110 }, // #9EE12F (A vibrant green/yellow that implies dynamic for Preset 16)

  // Column 3: Really Intense / Strobe Effects (Reddish -> Orangish -> Yellow/Green -> Cyan/Blue -> Purple/Pink -> White/Rainbow)
  0x3A: { presetNum: 17, padColor: 4 },  // #FF4C4C (Bright Red, slightly softer than pure red for distinction from active blinking for Preset 17)
  0x32: { presetNum: 18, padColor: 8 },  // #FFBD6C (Brighter Orange for Preset 18)
  0x2A: { presetNum: 19, padColor: 12 }, // #FFFF4C (Bright Yellow for Preset 19)
  0x22: { presetNum: 20, padColor: 32 }, // #4CFFB7 (Bright Aqua/Light Cyan for Preset 20)
  0x1A: { presetNum: 21, padColor: 67 }, // #0000FF (Pure Blue for Preset 21)
  0x12: { presetNum: 22, padColor: 94 }, // #D31DFF (Bright Purple for Preset 22)
  0x0A: { presetNum: 23, padColor: 52 }, // #FF4CFF (Bright Magenta for Preset 23)
  0x02: { presetNum: 24, padColor: 3 }   // #FFFFFF (Pure White for Preset 24)
};


// Define effect presets for the WLED.
// The keys here are the actual preset numbers (1-24) that will be sent to WLED.
// These are decoupled from the MIDI pad notes.
const WLED_EFFECT_PRESETS = {
  // --- Column 1: Mild, Gradient Effects (Sorted by Color: Reddish -> Orangish -> Yellow/Green -> Cyan/Blue -> Purple/Pink -> White/Rainbow) ---
  1: { // Corresponds to APC Pad 0x38 (56) - Top-left
    effectId: 46, // Gradient (Smooth color transition)
    colors: [[255, 30, 0], [150, 0, 0], [50, 0, 0]], // Deep Red Gradient
    palette: 0,
    option: 0,
    padColor: 5 // #FF0000 (Closest bright red)
  },
  2: { // Corresponds to APC Pad 0x30 (48)
    effectId: 104, // Sunrise (Warm, gentle glow)
    colors: [[255, 100, 0], [255, 150, 50], [200, 80, 0]], // Sunset Orange/Gold
    palette: 0,
    option: 0,
    padColor: 9 // #FF5400 (Good orange)
  },
  3: { // Corresponds to APC Pad 0x28 (40)
    effectId: 107, // Noise Pal (Calm, evolving noise pattern with palette)
    colors: [[200, 255, 0], [150, 200, 0], [100, 150, 0]], // Lime Green / Yellowish Green
    palette: 0,
    option: 0,
    padColor: 16 // #88FF4C (Bright greenish-yellow)
  },
  4: { // Corresponds to APC Pad 0x20 (32)
    effectId: 67, // Colorwaves (Gentle waves, uses palette, so colors here influence the 'base' colors if palette is 0)
    colors: [[0, 255, 255], [0, 200, 200], [0, 150, 150]], // Bright Cyan / Aqua
    palette: 0, // Default palette
    option: 0,
    padColor: 36 // #4CC3FF (Bright cyan/light blue)
  },
  5: { // Corresponds to APC Pad 0x18 (24)
    effectId: 101, // Pacifica (Calm ocean waves)
    colors: [[0, 50, 255], [0, 100, 200], [50, 150, 255]], // Deep Ocean Blue
    palette: 0,
    option: 0,
    padColor: 45 // #0000FF (Pure blue)
  },
  6: { // Corresponds to APC Pad 0x10 (16)
    effectId: 75, // Lake (Calm palette waving)
    colors: [[50, 0, 255], [100, 0, 200], [150, 0, 150]], // Royal Purple
    palette: 0,
    option: 0,
    padColor: 49 // #5400FF (Vibrant purple)
  },
  7: { // Corresponds to APC Pad 0x08 (8)
    effectId: 38, // Aurora (Smooth, ethereal glow)
    colors: [[255, 0, 255], [200, 0, 200], [150, 0, 150]], // Magenta / Hot Pink
    palette: 0,
    option: 0,
    padColor: 53 // #FF00FF (Pure magenta)
  },
  8: { // Corresponds to APC Pad 0x00 (0) - Bottom-left
    effectId: 63, // Pride 2015 (Subtle rainbow cycle)
    colors: [[255, 255, 255], [0, 0, 0], [0, 0, 0]], // Primary color unused for this effect as it's a palette based rainbow
    palette: 0, // Using default rainbow palette implicitly
    option: 0,
    padColor: 114 // #80FFBD (A general vibrant, slightly greenish aqua to represent rainbow)
  },

  // --- Column 2: More Intense Effects (Sorted by Color: Reddish -> Orangish -> Yellow/Green -> Cyan/Blue -> Purple/Pink -> White/Rainbow) ---
  9: { // Corresponds to APC Pad 0x39
    effectId: 152, // DNA (Moving, intertwining strands)
    colors: [[255, 0, 0], [100, 0, 0], [50, 0, 0]], // Strong Red
    palette: 0,
    option: 0,
    padColor: 72 // #FF0000 (Pure Red, good match)
  },
  10: { // Corresponds to APC Pad 0x31
    effectId: 149, // Firenoise (Dynamic, organic fire simulation)
    colors: [[255, 60, 0], [255, 120, 0], [255, 180, 0]], // Fiery Orange
    palette: 0,
    option: 0,
    padColor: 96 // #FF7F00 (Vibrant Orange)
  },
  11: { // Corresponds to APC Pad 0x29
    effectId: 110, // Flow (Blending palette and spot effects, more active)
    colors: [[255, 255, 0], [200, 200, 0], [150, 150, 0]], // Vibrant Yellow
    palette: 0,
    option: 0,
    padColor: 13 // #FFFF00 (Pure Yellow)
  },
  12: { // Corresponds to APC Pad 0x21
    effectId: 164, // Drift (Rotating kaleidoscope, visually stimulating)
    colors: [[0, 255, 255], [50, 200, 200], [100, 150, 150]], // Electric Cyan
    palette: 0,
    option: 0,
    padColor: 37 // #00A9FF (Good bright blue/cyan)
  },
  13: { // Corresponds to APC Pad 0x19
    effectId: 180, // Hiphotic (Moving plasma, fluid and active)
    colors: [[0, 150, 255], [0, 100, 200], [0, 50, 150]], // Bright Blue Plasma
    palette: 0,
    option: 0,
    padColor: 41 // #0055FF (Medium blue)
  },
  14: { // Corresponds to APC Pad 0x11
    effectId: 177, // Frizzles (Complex moving patterns)
    colors: [[150, 0, 255], [100, 0, 200], [50, 0, 150]], // Deep Violet
    palette: 0,
    option: 0,
    padColor: 80 // #3F00FF (Darker Violet/Purple)
  },
  15: { // Corresponds to APC Pad 0x09
    effectId: 97, // Plasma (Classic plasma lamp effect)
    colors: [[255, 0, 150], [200, 0, 100], [150, 0, 50]], // Intense Pink/Magenta
    palette: 0,
    option: 0,
    padColor: 57 // #FF0054 (Bright Pink)
  },
  16: { // Corresponds to APC Pad 0x01
    effectId: 179, // Flow Stripe (Rotating colors, visually appealing)
    colors: [[255, 255, 255], [0, 0, 0], [0, 0, 0]], // This effect often uses hue speed, so primary color may be less impactful.
    palette: 0,
    option: 0,
    padColor: 110 // #9EE12F (A vibrant green/yellow that implies dynamic, good contrast)
  },

  // --- Column 3: Really Intense / Strobe Effects (Sorted by Color: Reddish -> Orangish -> Yellow/Green -> Cyan/Blue -> Purple/Pink -> White/Rainbow) ---
  17: { // Corresponds to APC Pad 0x3A
    effectId: 25, // Strobe Mega (Multiple short bursts)
    colors: [[255, 0, 0], [0, 0, 0], [0, 0, 0]], // Red Strobe
    palette: 0,
    option: 0,
    padColor: 4 // #FF4C4C (Bright Red, slightly softer than pure red for distinction from active blinking for Preset 17)
  },
  18: { // Corresponds to APC Pad 0x32
    effectId: 42, // Fireworks (Explosive, random color blobs)
    colors: [[255, 100, 0], [255, 50, 0], [200, 25, 0]], // Orange Fireworks
    palette: 0,
    option: 0,
    padColor: 8 // #FFBD6C (Brighter Orange for fireworks)
  },
  19: { // Corresponds to APC Pad 0x2A
    effectId: 89, // Fireworks Starburst (Exploding multicolor fireworks)
    colors: [[255, 255, 0], [200, 200, 0], [150, 150, 0]], // Yellow Starburst
    palette: 0,
    option: 0,
    padColor: 12 // #FFFF4C (Bright Yellow)
  },
  20: { // Corresponds to APC Pad 0x22
    effectId: 57, // Lightning (Short random white strobe, very intense)
    colors: [[0, 255, 255], [0, 0, 0], [0, 0, 0]], // Cyan Lightning
    palette: 0,
    option: 0,
    padColor: 32 // #4CFFB7 (Bright Aqua/Light Cyan)
  },
  21: { // Corresponds to APC Pad 0x1A
    effectId: 74, // Colortwinkles (Fast random twinkling in random colors)
    colors: [[0, 0, 255], [0, 0, 200], [0, 0, 150]], // Blue Twinkles
    palette: 0, // This effect also uses random colors, primary may not be dominant
    option: 0,
    padColor: 67 // #0000FF (Pure Blue)
  },
  22: { // Corresponds to APC Pad 0x12
    effectId: 7, // Dynamic (Rapid random color changes, very high energy)
    colors: [[128, 0, 255], [100, 0, 200], [50, 0, 150]], // Purple Dynamic
    palette: 0,
    option: 0,
    padColor: 94 // #D31DFF (Bright Purple)
  },
  23: { // Corresponds to APC Pad 0x0A
    effectId: 116, // TV Simulator (Rapid visual noise/static)
    colors: [[255, 0, 255], [200, 0, 200], [150, 0, 150]], // Magenta/Pink Noise
    palette: 0,
    option: 0,
    padColor: 52 // #FF4CFF (Bright Magenta)
  },
  24: { // Corresponds to APC Pad 0x02 - Bottom-right
    effectId: 23, // Strobe (Classic white strobe)
    colors: [[255, 255, 255], [0, 0, 0], [0, 0, 0]], // White Strobe
    palette: 0,
    option: 0,
    padColor: 3 // #FFFFFF (Pure White)
  }
};

function broadcast(data) {
  wss.clients.forEach((client) => {
    if (client.readyState === 1) client.send(JSON.stringify(data));
  });
}

function getMidiDevices() {
  const devices = [];
  const inputPortCount = midiInput.getPortCount();
  const outputPortCount = midiOutput.getPortCount();
  for (let i = 0; i < inputPortCount; i++) {
    devices.push({ id: i, name: midiInput.getPortName(i), type: "input" });
  }
  for (let i = 0; i < outputPortCount; i++) {
    devices.push({ id: i, name: midiOutput.getPortName(i), type: "output" });
  }
  return devices;
}

function connectMidi(inputId, outputId) {
  return new Promise((resolve, reject) => {
    try {
      if (midiInput) midiInput.closePort();
      if (midiOutput) midiOutput.closePort();
      midiInput = new midi.Input();
      midiOutput = new midi.Output();

      const inputPortIndex = parseInt(inputId);
      const outputPortIndex = parseInt(outputId);

      if (isNaN(inputPortIndex) || isNaN(outputPortIndex)) {
        return reject(new Error("Invalid MIDI port ID provided."));
      }

      if (
        inputPortIndex < 0 ||
        inputPortIndex >= midiInput.getPortCount() ||
        outputPortIndex < 0 ||
        outputPortIndex >= midiOutput.getPortCount()
      ) {
        return reject(new Error("Invalid MIDI port ID provided."));
      }

      midiInput.on("message", handleMidiInput);
      midiInput.on("error", (error) =>
        console.error("MIDI input error:", error)
      );
      midiInput.openPort(inputPortIndex);
      midiOutput.openPort(outputPortIndex);
      const inputName = midiInput.getPortName(inputPortIndex);
      const outputName = midiOutput.getPortName(outputPortIndex);
      console.log(`Connected MIDI input: ${inputName}, output: ${outputName}`);

      // Initialize APC pads after successful connection
      initializeApcPads();

      resolve({ input: inputName, output: outputName });
    } catch (error) {
      console.error("Error connecting to MIDI device:", error);
      reject(error);
    }
  });
}

// --- Art-Net Functions ---
function connectArtnet(host = '192.168.0.100', universe = 1) {
  try {
    if (artnetClient) {
      artnetClient.close();
    }

    artnetClient = Artnet({
      host: host,
      port: 6454,
      refresh: 1000, // Refresh rate in ms (adjust as needed)
    });

    wledArtnetConfig.host = host;
    wledArtnetConfig.universe = universe;

    console.log(`Art-Net connected to ${host}, universe ${universe}`);
    error = false;
    return true;
  } catch (err) {
    console.error('Art-Net connection failed:', err);
    error = true;
    return false;
  }
}

function sendArtnetPreset(presetNum) {
  if (!artnetClient) {
    console.error('Art-Net not connected');
    return false;
  }

  const preset = WLED_EFFECT_PRESETS[presetNum];
  if (!preset) {
    console.error(`Preset ${presetNum} not found.`);
    return false;
  }

  try {
    // Update current WLED state with the new preset,
    // but *retain* the current brightness, speed, and intensity values.
    currentWledState.ps = presetNum;

    // Send the full Art-Net packet using the stored state values
    const effectData = [
      currentWledState.bri,           // Ch 1: Master Dimmer (from state)
      preset.effectId,                // Ch 2: Effect ID
      currentWledState.speed,         // Ch 3: Effect speed (from state)
      currentWledState.intensity,     // Ch 4: Effect intensity (from state)
      preset.palette,                 // Ch 5: Palette ID
      preset.option,                  // Ch 6: Effect option
      preset.colors[0][0],            // Ch 7: Red Primary
      preset.colors[0][1],            // Ch 8: Green Primary
      preset.colors[0][2],            // Ch 9: Blue Primary
      preset.colors[1][0],            // Ch 10: Red Secondary
      preset.colors[1][1],            // Ch 11: Green Secondary
      preset.colors[1][2],            // Ch 12: Blue Secondary
      preset.colors[2][0],            // Ch 13: Red Tertiary
      preset.colors[2][1],            // Ch 14: Green Tertiary
      preset.colors[2][2]             // Ch 15: Blue Tertiary
    ];

    artnetClient.set(wledArtnetConfig.universe, effectData);

    console.log(`Art-Net Effect: Universe ${wledArtnetConfig.universe}, Effect: ${preset.effectId} (Preset ${presetNum})`);
    console.log(`Current State - Bri: ${currentWledState.bri}, Speed: ${currentWledState.speed}, Intensity: ${currentWledState.intensity}`);

    // Update APC pads to reflect the active preset
    updateApcPads();
    return true;
  } catch (err) {
    console.error('Art-Net send failed:', err);
    return false;
  }
}

function sendArtnetEffectUpdate() {
  if (!artnetClient) {
    console.error('Art-Net not connected');
    return false;
  }

  // If no preset is active, we can't update speed/intensity of an unknown effect.
  // Consider sending a default white or a "no effect" state if ps is -1.
  if (currentWledState.ps === -1) {
    console.warn("No active preset to update effect parameters for. Select a preset first.");
    return false;
  }

  try {
    const currentPresetNum = currentWledState.ps;
    const preset = WLED_EFFECT_PRESETS[currentPresetNum]; // Already validated in sendArtnetPreset

    if (!preset) { // Should not happen if currentWledState.ps is valid
        console.error(`Active Preset ${currentPresetNum} not found in WLED_EFFECT_PRESETS.`);
        return false;
    }

    const effectData = [
      currentWledState.bri,           // Ch 1: Master Dimmer
      preset.effectId,                // Ch 2: Effect ID
      currentWledState.speed,         // Ch 3: Effect speed (from state)
      currentWledState.intensity,     // Ch 4: Effect intensity (from state)
      preset.palette,                 // Ch 5: Palette ID
      preset.option,                  // Ch 6: Effect option
      preset.colors[0][0],            // Ch 7: Red Primary
      preset.colors[0][1],            // Ch 8: Green Primary
      preset.colors[0][2],            // Ch 9: Blue Primary
      preset.colors[1][0],            // Ch 10: Red Secondary
      preset.colors[1][1],            // Ch 11: Green Secondary
      preset.colors[1][2],            // Ch 12: Blue Secondary
      preset.colors[2][0],            // Ch 13: Red Tertiary
      preset.colors[2][1],            // Ch 14: Green Tertiary
      preset.colors[2][2]             // Ch 15: Blue Tertiary
    ];

    artnetClient.set(wledArtnetConfig.universe, effectData);
    console.log(`Art-Net State Update: Bri: ${currentWledState.bri}, Speed: ${currentWledState.speed}, Intensity: ${currentWledState.intensity}`);
    return true;
  } catch (err) {
    console.error('Art-Net effect update failed:', err);
    return false;
  }
}


// Test function to debug Art-Net
function testArtnet() {
  if (!artnetClient) {
    console.log('Art-Net not connected');
    return;
  }

  console.log('Testing Art-Net connection...');
  console.log('Client:', artnetClient);
  console.log('Config:', wledArtnetConfig);

  // Test with sending preset 1, will use default speed/intensity
  sendArtnetPreset(1);
}

// --- WLED and APC Control Logic ---

function handleMidiInput(deltaTime, message) {
  const [status, note, velocity] = message;
  const command = status >> 4;

  // Broadcast MIDI event to clients
  broadcast({ type: "midi_event", data: { command, note, velocity } });

  // Handle pad presses (Note On, channel 1)
  if (command === (MIDI_COMMANDS.NOTE_ON >> 4) && velocity > 0) { // Check for Note On (0x90)
    const padMapping = APC_PAD_MAPPING[note];
    if (padMapping) {
      const presetNum = padMapping.presetNum;
      console.log(`Pad ${note} pressed -> Activating Preset ${presetNum}`);
      sendArtnetPreset(presetNum); // Activate the WLED preset, will use current state values
    }
  }

  // Handle faders (Control Change)
  if (command === 0xB) { // Control Change (0xB0)
    // Fader for brightness (Note 48 in APC Mini MK2 usually maps to CC 48)
    if (note === 48) {
      currentWledState.bri = velocity * 2; // MIDI velocity is 0-127, DMX is 0-255
      sendArtnetEffectUpdate(); // Send update with new brightness
    }
    // Fader for Speed (Note 49 for CC 49)
    if (note === 49) {
      currentWledState.speed = velocity * 2; // Update state speed
      sendArtnetEffectUpdate(); // Send update with new speed
    }
    // Fader for Intensity (Note 50 for CC 50)
    if (note === 50) {
      currentWledState.intensity = velocity * 2; // Update state intensity
      sendArtnetEffectUpdate(); // Send update with new intensity
    }
  }
}

// Resets all APC pads to off and then sets the initial state
function initializeApcPads() {
  if (!midiOutput || !midiOutput.isPortOpen()) {
    console.warn("MIDI output not open, cannot initialize APC pads.");
    return;
  }

  // Turn off all pads (0-63)
  for (let i = 0; i <= 63; i++) {
    midiOutput.sendMessage([MIDI_COMMANDS.PAD_SOLID, i, 0]); // Note Off (velocity 0)
  }

  // Then update with the current state (all mapped pads to their base color)
  updateApcPads();
}


function updateApcPads() {
  if (!midiOutput || !midiOutput.isPortOpen()) {
    console.warn("MIDI output not open, cannot update APC pads.");
    return;
  }

  const activePresetNum = currentWledState?.ps;

  // Iterate over the APC_PAD_MAPPING to set pad colors
  Object.entries(APC_PAD_MAPPING).forEach(([midiNoteStr, padInfo]) => {
    const midiNote = parseInt(midiNoteStr, 10);
    const presetNum = padInfo.presetNum;
    const padColor = padInfo.padColor;

    let command = MIDI_COMMANDS.PAD_SOLID; // Default to solid color

    // If this pad's preset number matches the active WLED preset, make it blink
    if (presetNum === activePresetNum) {
      console.log(`Pad ${midiNote} is active, blinking fast`);
      command = MIDI_COMMANDS.PAD_BLINK_FAST;
    }

    midiOutput.sendMessage([command, midiNote, padColor]);
  });
}

// WebSocket server connection handling
wss.on("connection", (ws) => {
  console.log("Frontend connected");
  ws.on("close", () => console.log("Frontend disconnected"));
  ws.send(
    JSON.stringify({
      type: "initial_state",
      data: { midiDevices, wledState: currentWledState },
    })
  );
  ws.on("message", async (message) => {
    try {
      const data = JSON.parse(message.toString());
      switch (data.type) {
        case "connect_midi":
          try {
            await connectMidi(data.inputId, data.outputId);
            ws.send(JSON.stringify({ type: "midi_connected" }));
          } catch (error) {
            ws.send(
              JSON.stringify({
                type: "error",
                message: `MIDI Connection Failed: ${error.message}`,
              })
            );
          }
          break;
        case "connect_artnet":
          try {
            const success = connectArtnet(data.host || '192.168.0.100', data.universe || 1);
            if (success) {
              // No need to loadPresetColors, as WLED_EFFECT_PRESETS are static
              ws.send(JSON.stringify({ type: "artnet_connected", host: data.host, universe: data.universe }));
            } else {
              ws.send(
                JSON.stringify({
                  type: "error",
                  message: "Art-Net connection failed",
                })
              );
            }
          } catch (error) {
            ws.send(
              JSON.stringify({
                type: "error",
                message: `Art-Net Connection Failed: ${error.message}`,
              })
            );
          }
          break;
        case "request_preset":
          try {
            const presetId = parseInt(data.presetId);
            if (isNaN(presetId) || presetId < 1) {
              ws.send(
                JSON.stringify({
                  type: "error",
                  message: "Invalid preset ID",
                })
              );
              break;
            }
            // When requesting a preset via WebSocket, use the current state values
            sendArtnetPreset(presetId);
            ws.send(JSON.stringify({ type: "preset_requested", presetId, message: `Preset ${presetId} sent via Art-Net` }));
          } catch (error) {
            ws.send(
              JSON.stringify({
                type: "error",
                message: `Preset Request Failed: ${error.message}`,
              })
            );
          }
          break;
        case "test_artnet":
          try {
            testArtnet();
            ws.send(JSON.stringify({ type: "artnet_test", message: "Art-Net test executed" }));
          } catch (error) {
            ws.send(
              JSON.stringify({
                type: "error",
                message: `Art-Net Test Failed: ${error.message}`,
              })
            );
          }
          break;
        case "refresh_devices":
          midiDevices = getMidiDevices();
          broadcast({ type: "devices_updated", data: { midiDevices } });
          break;
        // ... other cases
      }
    } catch (error) {
      console.error("Error processing WebSocket message:", error);
    }
  });
});

// --- API Routes ---
app.get("/api/devices/midi", (req, res) => res.json(getMidiDevices()));

// Art-Net API endpoints
app.post("/api/artnet/connect", (req, res) => {
  try {
    const { host, universe } = req.body;
    const success = connectArtnet(host || '192.168.0.100', universe || 1);
    if (success) {
      res.json({ success: true, message: `Art-Net connected to ${host || '192.168.0.100'}` });
    } else {
      res.status(500).json({ success: false, error: "Art-Net connection failed" });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post("/api/artnet/preset", (req, res) => {
  try {
    const { presetId } = req.body; // Remove brightness from here as it's from currentWledState
    if (!presetId || presetId < 1) {
      return res.status(400).json({ success: false, error: "Invalid preset ID" });
    }
    // sendArtnetPreset now only takes presetId, it uses the global state for other values
    const success = sendArtnetPreset(presetId);
    if (success) {
      res.json({ success: true, message: `Preset ${presetId} sent` });
    } else {
      res.status(500).json({ success: false, error: "Failed to send preset" });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// --- Server Start ---
app.listen(port, "0.0.0.0", async () => {
  console.log(`Server running on http://localhost:${port}`);
  console.log(`WebSocket server running on ws://localhost:3002`);
  midiDevices = getMidiDevices();
});