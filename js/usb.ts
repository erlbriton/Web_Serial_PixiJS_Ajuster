// js/usb.ts

interface UsbChipEntry {
    name: string;
    pids: Record<string, string>;
}

const USB_CHIPS_DATABASE: Record<string, UsbChipEntry> = {
    '10c4': {
        name: 'Silicon Labs',
        pids: {
            'ea60': 'CP2103',
            'ea70': 'CP2105',
            'ea71': 'CP2108'
        }
    },
    '0403': {
        name: 'FTDI',
        pids: {
            '6001': 'FT232R',
            '6010': 'FT2232H',
            '6015': 'FT231X'
        }
    },
    '1a86': {
        name: 'Qinheng',
        pids: {
            '7523': 'CH340/CH341',
            '5523': 'CH341A'
        }
    },
    '067b': {
        name: 'Prolific',
        pids: {
            '2303': 'PL2303'
        }
    }
};

interface UsbPortInfo {
    usbVendorId?: number;
    usbProductId?: number;
}

/**
 * Определяет название USB-UART чипа по VID/PID
 */
export function identifyUsbChip(info: UsbPortInfo | null | undefined): string {
    if (!info || typeof info.usbVendorId !== 'number') {
        return "Встроенный COM-порт";
    }

    const vidStr = info.usbVendorId.toString(16).padStart(4, '0').toLowerCase();
    const pidStr = typeof info.usbProductId === 'number' 
        ? info.usbProductId.toString(16).padStart(4, '0').toLowerCase() 
        : null;

    const manufacturer = USB_CHIPS_DATABASE[vidStr];
    
    if (manufacturer) {
        if (pidStr && manufacturer.pids[pidStr]) {
            return manufacturer.pids[pidStr];
        }
        return `${manufacturer.name} USB`;
    }

    return `USB [${vidStr.toUpperCase()}:${pidStr ? pidStr.toUpperCase() : '????'}]`;
}