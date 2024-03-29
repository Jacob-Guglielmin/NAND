type Wire = {
    fromOutput?: Pin;
    path: XY[];
    toInput?: Pin;
};

const WIRE_OFF_COLOR = "#000000";
const WIRE_ON_COLOR = "#ff0000";
const WIRE_ERROR_COLOR = "#ffff00";
const WIRE_WIDTH = 5;

const CHIP_WIDTH = 100;
const CHIP_HEIGHT = 100;

const PIN_RADIUS = 7;

const canvas = document.getElementById("canvas") as HTMLCanvasElement;
const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
const buttonDiv = document.getElementById("buttons") as HTMLDivElement;
const placementAlert = document.getElementById("placementAlert") as HTMLDivElement;
const placementAlertChip = document.getElementById("placementAlertChip") as HTMLSpanElement;

ctx.canvas.width = Math.round(document.body.getBoundingClientRect().width);
ctx.canvas.height = Math.round(document.body.getBoundingClientRect().height * 0.84);

const wires: Map<ChipID, Wire[][]> = new Map();

function pinPosition(pin: Pin): XY {
    const chip = getChip(pin.chipID);

    if (pin.isOutput) {
        return {
            x: chip.position.x + CHIP_WIDTH,
            y: chip.position.y + (CHIP_HEIGHT * (pin.pinID + 1)) / (chip.outputs.length + 1)
        };
    } else {
        return {
            x: chip.position.x,
            y: chip.position.y + (CHIP_HEIGHT * (pin.pinID + 1)) / (chip.inputs.length + 1)
        };
    }
}

function fullWirePath(wire: Wire): XY[] {
    if (wire.fromOutput === undefined || wire.toInput === undefined) throw new Error("Wire is not connected");

    return [pinPosition(wire.fromOutput)].concat(wire.path, pinPosition(wire.toInput));
}

function deleteWire(fromOutput: Pin, toInput: Pin) {
    for (let [outputPin, wiresFromPin] of wires.get(fromOutput.chipID)!.entries()) {
        wires.get(fromOutput.chipID)![outputPin] = wiresFromPin.filter(
            (x) => x.toInput?.chipID !== toInput.chipID || x.toInput?.pinID !== toInput.pinID
        );
    }
}

function insertAddChipButton(chipType: ChipType): void {
    const addChipButton = document.createElement("button");
    addChipButton.innerText = chipType.type;
    addChipButton.addEventListener("click", () => {
        placingChip = true;
        placingChipType = chipType;
        placingChipID = addChip(chipType, { x: 0, y: 0 });

        selectedChip = null;
        chipOffset = null;
        selectedPin = null;
        currentWirePath = null;

        setFooter(false, chipType.type);

        render();
    });
    buttonDiv.appendChild(addChipButton);
}

function setFooter(buttonsVisible: boolean, chipNamePlacing?: ChipTypeID): void {
    if (buttonsVisible) {
        buttonDiv.classList.remove("hidden");
        placementAlert.classList.add("hidden");
    } else {
        if (chipNamePlacing == undefined) {
            throw new Error("Chip name placing is undefined");
        }
        placementAlertChip.innerText = chipNamePlacing;

        buttonDiv.classList.add("hidden");
        placementAlert.classList.remove("hidden");
    }
}

function drawChip(chip: Chip): void {
    // Chip body
    ctx.fillStyle = hoveredChip == chip.id || selectedChip == chip.id ? "#3333ff" : "#0000ff";
    ctx.fillRect(chip.position.x, chip.position.y, CHIP_WIDTH, CHIP_HEIGHT);

    // Chip name
    ctx.fillStyle = "white";
    ctx.font = "20px Arial";
    ctx.fillText(chip.type, chip.position.x + 10, chip.position.y + 20);

    // Input pins
    for (let inputPin = 0; inputPin < chip.inputs.length; inputPin++) {
        const pinPos = pinPosition({ chipID: chip.id, pinID: inputPin, isOutput: false });

        if (hoveredPin?.chipID === chip.id && hoveredPin?.pinID === inputPin && !hoveredPin.isOutput) {
            ctx.fillStyle = "white";
            ctx.beginPath();
            ctx.arc(pinPos.x, pinPos.y, PIN_RADIUS + 2, 0, 2 * Math.PI);
            ctx.fill();
        }

        ctx.fillStyle = oscillators.has(JSON.stringify(chip.inputPins[inputPin]))
            ? WIRE_ERROR_COLOR
            : chip.inputs[inputPin]
            ? WIRE_ON_COLOR
            : WIRE_OFF_COLOR;
        ctx.beginPath();
        ctx.arc(pinPos.x, pinPos.y, PIN_RADIUS, 0, 2 * Math.PI);
        ctx.fill();
    }

    // Output pins
    for (let outputPin = 0; outputPin < chip.outputs.length; outputPin++) {
        const pinPos = pinPosition({ chipID: chip.id, pinID: outputPin, isOutput: true });

        if (hoveredPin?.chipID === chip.id && hoveredPin?.pinID === outputPin && hoveredPin.isOutput) {
            ctx.fillStyle = "white";
            ctx.beginPath();
            ctx.arc(pinPos.x, pinPos.y, PIN_RADIUS + 2, 0, 2 * Math.PI);
            ctx.fill();
        }

        ctx.fillStyle = oscillators.has(JSON.stringify({ chipID: chip.id, pinID: outputPin, isOutput: true }))
            ? WIRE_ERROR_COLOR
            : chip.outputs[outputPin]
            ? WIRE_ON_COLOR
            : WIRE_OFF_COLOR;
        ctx.beginPath();
        ctx.arc(pinPos.x, pinPos.y, PIN_RADIUS, 0, 2 * Math.PI);
        ctx.fill();
    }
}

function drawWires(): void {
    for (let [chipID, wiresOut] of wires) {
        for (let [outputPin, wiresFromPin] of wiresOut.entries()) {
            for (let wire of wiresFromPin) {
                const fullPath = fullWirePath(wire);

                ctx.strokeStyle = oscillators.has(JSON.stringify({ chipID, pinID: outputPin, isOutput: true }))
                    ? WIRE_ERROR_COLOR
                    : getChip(chipID).outputs[outputPin]
                    ? WIRE_ON_COLOR
                    : WIRE_OFF_COLOR;
                ctx.lineWidth =
                    hoveredWire !== null &&
                    hoveredWire.toInput?.chipID === wire.toInput?.chipID &&
                    hoveredWire.toInput?.pinID === wire.toInput?.pinID
                        ? WIRE_WIDTH * 1.5
                        : WIRE_WIDTH;

                ctx.beginPath();
                ctx.moveTo(fullPath[0].x, fullPath[0].y);

                for (let point of fullPath.slice(1)) {
                    ctx.lineTo(point.x, point.y);
                }

                ctx.stroke();
            }
        }
    }

    if (selectedPin !== null && currentWirePath !== null) {
        let fullPath: XY[];
        if (!selectedPin.isOutput) {
            ctx.strokeStyle = WIRE_OFF_COLOR;

            fullPath = [mousePosition].concat(currentWirePath!.path, pinPosition(selectedPin));
        } else {
            ctx.strokeStyle = oscillators.has(
                JSON.stringify({ chipID: selectedPin.chipID, pinID: selectedPin.pinID, isOutput: true })
            )
                ? WIRE_ERROR_COLOR
                : getChip(selectedPin.chipID).outputs[selectedPin.pinID]
                ? WIRE_ON_COLOR
                : WIRE_OFF_COLOR;

            fullPath = [pinPosition(selectedPin)].concat(currentWirePath!.path, mousePosition);
        }

        ctx.lineWidth = WIRE_WIDTH;
        ctx.beginPath();
        ctx.moveTo(fullPath[0].x, fullPath[0].y);

        for (let point of fullPath.slice(1)) {
            ctx.lineTo(point.x, point.y);
        }

        ctx.stroke();
    }
}

function chooseCursorAppearance(): void {
    if (placingChip) {
        ctx.canvas.style.cursor = "pointer";
    } else if (mouseDown && selectedChip !== null) {
        ctx.canvas.style.cursor = dragged || getChip(selectedChip).type != INPUT.type ? "grabbing" : "pointer";
    } else if (hoveredPin !== null) {
        ctx.canvas.style.cursor = "pointer";
    } else if (selectedPin !== null) {
        ctx.canvas.style.cursor = "crosshair";
    } else if (hoveredWire !== null) {
        ctx.canvas.style.cursor = "pointer";
    } else if (hoveredChip !== null) {
        ctx.canvas.style.cursor = getChip(hoveredChip).type != INPUT.type ? "grab" : "pointer";
    } else {
        ctx.canvas.style.cursor = "default";
    }
}

function render(): void {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    drawWires();

    for (let chipID of Array.from(chips.keys()).reverse()) {
        if (chipID !== placingChipID) {
            drawChip(getChip(chipID));
        }
    }

    if (placingChipID !== null && mouseOverCanvas) {
        ctx.globalAlpha = 0.5;
        drawChip(getChip(placingChipID));
        ctx.globalAlpha = 1;
    }

    chooseCursorAppearance();
}

function chipUnder(position: XY): ChipID | null {
    for (const [id, chip] of chips) {
        if (
            position.x >= chip.position.x &&
            position.x <= chip.position.x + CHIP_WIDTH &&
            position.y >= chip.position.y &&
            position.y <= chip.position.y + CHIP_HEIGHT
        ) {
            return id;
        }
    }

    return null;
}

function pinUnder(position: XY): Pin | null {
    for (const [id, chip] of chips) {
        for (let outputPin = 0; outputPin < chip.outputs.length; outputPin++) {
            if (
                euclideanDistance(position, pinPosition({ chipID: id, pinID: outputPin, isOutput: true })) <= PIN_RADIUS
            )
                return { chipID: id, pinID: outputPin, isOutput: true };
        }

        for (let inputPin = 0; inputPin < chip.inputs.length; inputPin++) {
            if (
                euclideanDistance(position, pinPosition({ chipID: id, pinID: inputPin, isOutput: false })) <= PIN_RADIUS
            )
                return { chipID: id, pinID: inputPin, isOutput: false };
        }
    }

    return null;
}

function wireUnder(position: XY): Wire | null {
    for (const [chipID, wiresOut] of wires) {
        for (let [outputPin, wiresFromPin] of wiresOut.entries()) {
            for (let wire of wiresFromPin) {
                const fullPath = fullWirePath(wire);

                for (let i = 0; i < fullPath.length - 1; i++) {
                    if (distPointToLineSegment(position, fullPath[i], fullPath[i + 1]) <= WIRE_WIDTH * 1.5) {
                        return wire;
                    }
                }
            }
        }
    }

    return null;
}

let mousePosition: XY = { x: 0, y: 0 };
let mouseDown = false;
let mouseDownPosition: XY | null = null;
let dragged = false;
let mouseOverCanvas = false;

let placingChip = false;
let placingChipType: ChipType | null = null;
let placingChipID: ChipID | null = null;

let selectedChip: ChipID | null = null;
let chipOffset: XY | null = null;

let selectedPin: Pin | null = null;
let currentWirePath: Wire | null = null;

let hoveredPin: Pin | null = null;
let hoveredWire: Wire | null = null;
let hoveredChip: ChipID | null = null;

function mouseDownHandler(eventPosition: XY): void {
    mouseDown = true;
    const rect = ctx.canvas.getBoundingClientRect();
    mousePosition = {
        x: (eventPosition.x - rect.left) * (ctx.canvas.width / rect.width),
        y: (eventPosition.y - rect.top) * (ctx.canvas.height / rect.height)
    };
    mouseDownPosition = {
        x: mousePosition.x,
        y: mousePosition.y
    };

    if (placingChip) {
        placingChip = false;
        placingChipType = null;
        placingChipID = null;
        setFooter(true);
        return;
    }

    hoveredPin = pinUnder(mousePosition);
    if (hoveredPin !== null) {
        if (selectedPin !== null && hoveredPin.isOutput !== selectedPin.isOutput) {
            if (selectedPin.isOutput) {
                currentWirePath!.toInput = hoveredPin;
            } else {
                currentWirePath!.fromOutput = hoveredPin;
            }

            let incomingFrom = getChip(currentWirePath!.toInput!.chipID).inputPins[currentWirePath!.toInput!.pinID];
            if (incomingFrom !== null) disconnect(incomingFrom, currentWirePath!.toInput!);

            wires.get(currentWirePath!.fromOutput!.chipID)![currentWirePath!.fromOutput!.pinID].push(currentWirePath!);
            connect(currentWirePath!.fromOutput!, currentWirePath!.toInput!);

            selectedPin = null;
        } else {
            selectedPin = hoveredPin;
            currentWirePath = {
                path: [],
                fromOutput: hoveredPin.isOutput ? hoveredPin : undefined,
                toInput: hoveredPin.isOutput ? undefined : hoveredPin
            };
        }

        return;
    }

    if (selectedPin !== null) {
        if (selectedPin.isOutput) {
            currentWirePath!.path.push(mousePosition);
        } else {
            currentWirePath!.path.unshift(mousePosition);
        }

        return;
    }

    hoveredChip = chipUnder(mousePosition);
    if (hoveredChip !== null) {
        selectedChip = hoveredChip;
        chipOffset = {
            x: mousePosition.x - getChip(selectedChip).position.x,
            y: mousePosition.y - getChip(selectedChip).position.y
        };
        return;
    }
}

function mouseUpHandler(): void {
    mouseDown = false;
    if (selectedChip === null) return;

    if (getChip(selectedChip).type === INPUT.type) {
        if (!dragged) {
            setInput(selectedChip, !getChip(selectedChip).outputs[0]);
        }
    }

    mouseDownPosition = null;
    dragged = false;
    selectedChip = null;
    chipOffset = null;
}

function mouseMoveHandler(eventPosition: XY): void {
    const rect = ctx.canvas.getBoundingClientRect();
    mousePosition = {
        x: (eventPosition.x - rect.left) * (ctx.canvas.width / rect.width),
        y: (eventPosition.y - rect.top) * (ctx.canvas.height / rect.height)
    };
    hoveredPin = null;
    hoveredWire = null;
    hoveredChip = null;

    if (placingChip) {
        getChip(placingChipID!).position.x = clamp(mousePosition.x - CHIP_WIDTH / 2, 0, ctx.canvas.width - CHIP_WIDTH);
        getChip(placingChipID!).position.y = clamp(
            mousePosition.y - CHIP_HEIGHT / 2,
            0,
            ctx.canvas.height - CHIP_HEIGHT
        );
        return;
    }

    if (mouseDown && selectedChip !== null) {
        if (!dragged && mouseDownPosition !== null) {
            if (euclideanDistance(mousePosition, mouseDownPosition) > 5) {
                dragged = true;
            }
        }

        const chip = getChip(selectedChip);
        if (dragged) {
            chip.position.x = clamp(mousePosition.x - chipOffset!.x, 0, ctx.canvas.width - CHIP_WIDTH);
            chip.position.y = clamp(mousePosition.y - chipOffset!.y, 0, ctx.canvas.height - CHIP_HEIGHT);
        }

        return;
    }

    hoveredPin = pinUnder(mousePosition);

    if (hoveredPin !== null || selectedPin !== null) return;

    hoveredWire = wireUnder(mousePosition);
    if (hoveredWire !== null) return;

    hoveredChip = chipUnder(mousePosition);
}

function keyDownHandler(key: string): void {
    if (key === "Escape") {
        if (placingChip) {
            deleteChip(placingChipID!);
            placingChip = false;
            placingChipID = null;
            placingChipType = null;
            setFooter(true);
        } else if (selectedPin !== null) {
            selectedPin = null;
            currentWirePath = null;
        }
    } else if (key === "Backspace" || key === "Delete") {
        if (hoveredWire !== null) {
            disconnect(hoveredWire.fromOutput!, hoveredWire.toInput!);
            hoveredWire = null;
        } else if (hoveredChip !== null) {
            deleteChip(hoveredChip);
            hoveredChip = null;
        }
    }
}

canvas.addEventListener("mousedown", (e) => {
    mouseDownHandler({ x: e.clientX, y: e.clientY });
    mouseMoveHandler({ x: e.clientX, y: e.clientY });
    render();
});
canvas.addEventListener("mouseup", (e) => {
    mouseUpHandler();
    mouseMoveHandler({ x: e.clientX, y: e.clientY });
    render();
});
canvas.addEventListener("mousemove", (e) => {
    mouseMoveHandler({ x: e.clientX, y: e.clientY });
    render();
});
canvas.addEventListener("mouseenter", () => {
    mouseOverCanvas = true;
});
canvas.addEventListener("mouseleave", () => {
    mouseOverCanvas = false;
    render();
});
document.addEventListener("keydown", (e) => {
    keyDownHandler(e.key);
    mouseMoveHandler(mousePosition);
    render();
});
