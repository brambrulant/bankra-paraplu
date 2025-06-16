# APC Mini MK2 + WLED Controller

A web application that connects an APC Mini MK2 MIDI controller to an ESP32 running WLED via serial communication. Control WLED presets with the APC pads and adjust brightness with the faders.

## Features

- **MIDI Controller Support**: Connect to APC Mini MK2 and other MIDI devices
- **WLED Integration**: Control WLED presets and brightness via serial communication
- **Real-time Visualization**: See LED animations and current state in the browser
- **Device Management**: Easy device selection and connection status monitoring
- **MIDI Event Logging**: Real-time display of MIDI events for debugging

## Hardware Requirements

- **APC Mini MK2** (or compatible MIDI controller)
- **ESP32** with WLED firmware installed
- **USB cables** for both devices

## Software Requirements

- Node.js (v16 or higher)
- npm or yarn

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd paraplu
```

2. Install dependencies:
```bash
npm install
```

3. Start the application:
```bash
npm start
```

This will start both the backend server (port 3001) and the frontend development server (port 5173).

## Usage

### 1. Connect Hardware

- Connect your APC Mini MK2 to your computer via USB
- Connect your ESP32 with WLED to your computer via USB

### 2. Open the Application

Navigate to `http://localhost:5173` in your web browser.

### 3. Select Devices

- **MIDI Controller**: Select your APC Mini MK2 from the device list
- **WLED Device**: Select the serial port where your ESP32 is connected

### 4. Control WLED

#### Pad Mapping (First 3 Columns Only)

The APC Mini MK2 has an 8x8 grid of pads. This application uses only the first 3 columns:

**Column 1 (Leftmost)**: Pads 0, 8, 16, 24, 32, 40, 48, 56
- Pad 0 → WLED Preset 1
- Pad 8 → WLED Preset 2
- Pad 16 → WLED Preset 3
- Pad 24 → WLED Preset 4
- Pad 32 → WLED Preset 5
- Pad 40 → WLED Preset 6
- Pad 48 → WLED Preset 7
- Pad 56 → WLED Preset 8

**Column 2 (Middle)**: Pads 1, 9, 17, 25, 33, 41, 49, 57
- Pad 1 → WLED Preset 9
- Pad 9 → WLED Preset 10
- Pad 17 → WLED Preset 11
- Pad 25 → WLED Preset 12
- Pad 33 → WLED Preset 13
- Pad 41 → WLED Preset 14
- Pad 49 → WLED Preset 15
- Pad 57 → WLED Preset 16

**Column 3 (Rightmost)**: Pads 2, 10, 18, 26, 34, 42, 50, 58
- Pad 2 → WLED Preset 17
- Pad 10 → WLED Preset 18
- Pad 18 → WLED Preset 19
- Pad 26 → WLED Preset 20
- Pad 34 → WLED Preset 21
- Pad 42 → WLED Preset 22
- Pad 50 → WLED Preset 23
- Pad 58 → WLED Preset 24

#### Fader Control

- **Fader 1** (CC 0): Controls overall WLED brightness (0-255)

### 5. Monitor Activity

- **LED Visualization**: See a real-time animation of your LED strip
- **MIDI Events**: Monitor incoming MIDI events in the event log
- **Connection Status**: Check device connection status

## WLED Setup

### Firmware Installation

1. Download WLED firmware from [WLED GitHub](https://github.com/Aircoookie/WLED)
2. Flash your ESP32 with the WLED firmware
3. Connect to the WLED WiFi access point
4. Configure your LED strip settings
5. Create presets (1-24) that you want to control

### Serial Communication

The application communicates with WLED using the JSON API over serial:

- **Baud Rate**: 115200
- **Protocol**: JSON over Serial
- **Commands**: Preset selection and brightness control

### Preset Configuration

Create presets in WLED with different colors and effects. The application will:

1. Send preset selection commands when pads are pressed
2. Extract dominant colors from presets
3. Update APC pad colors based on the preset's dominant color
4. Control brightness with the first fader

## Development

### Project Structure

```
├── server.js              # Backend server (Express + WebSocket)
├── src/
│   ├── components/        # React components
│   │   ├── DeviceSelector.tsx
│   │   ├── LEDVisualization.tsx
│   │   ├── ConnectionStatus.tsx
│   │   └── MIDIEventLog.tsx
│   ├── App.tsx           # Main React component
│   └── main.tsx          # React entry point
├── package.json
└── README.md
```

### Backend API

- **WebSocket**: Real-time communication with frontend
- **REST API**: Device management and WLED control
- **MIDI Handling**: Input/output for MIDI devices
- **Serial Communication**: WLED control via serial port

### Frontend Features

- **Device Selection**: MIDI and serial device management
- **Real-time Updates**: WebSocket communication with backend
- **LED Visualization**: Canvas-based LED strip animation
- **Event Logging**: MIDI event monitoring and display

## Troubleshooting

### MIDI Issues

- **No MIDI devices found**: Ensure your MIDI controller is properly connected and recognized by your OS
- **Connection failed**: Check if another application is using the MIDI device
- **No events received**: Verify the MIDI device is selected and connected

### Serial Issues

- **No serial devices found**: Check USB connection and drivers
- **Connection failed**: Ensure WLED is running and the correct port is selected
- **Communication errors**: Verify baud rate and WLED serial settings

### General Issues

- **WebSocket connection failed**: Ensure the backend server is running on port 3002
- **Frontend not loading**: Check if the development server is running on port 5173
- **Permission errors**: On macOS/Linux, you may need to run with sudo for serial access

## License

This project is licensed under the MIT License.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## Support

For issues and questions:
- Check the troubleshooting section
- Review WLED documentation
- Check MIDI device compatibility
- Ensure proper USB connections
