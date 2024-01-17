type Pin = {
    chipID: ChipID;
    pinID: number;
    isOutput: boolean;
};

type ChipID = number & { __chipID: never };

type Chip = {
    id: ChipID;
    type: string;
    inputs: boolean[];
    outputs: boolean[];
    inputPins: (Pin | null)[];
    outputPins: Pin[][];

    position: XY;
};

type ChipType = {
    type: string;
    inputs: number;
    outputs: number;
    initialOutput?: boolean;
};

const INPUT: ChipType = {
    type: "INPUT",
    inputs: 0,
    outputs: 1,
    initialOutput: false
};

const OUTPUT: ChipType = {
    type: "OUTPUT",
    inputs: 1,
    outputs: 0
};

const NAND: ChipType = {
    type: "NAND",
    inputs: 2,
    outputs: 1,
    initialOutput: true
};

const nand = (a: boolean, b: boolean): boolean => !(a && b);

const MAX_UPDATES = 10000;
const OSCILLATION_CHECK_UPDATES = 200;

const inputChips: ChipID[] = [];
const outputChips: ChipID[] = [];
const chips: Map<ChipID, Chip> = new Map();
let nextID: ChipID = 0 as ChipID;

const definedChips: ChipType[] = [INPUT, OUTPUT, NAND];

let oscillators: Set<string> = new Set();
let recheckOscillators: ChipID[] = [];

function addChip(type: ChipType): ChipID {
    if (type.outputs !== 0 && type.initialOutput === undefined)
        throw new Error("Initial output must be defined for chips with outputs");

    chips.set(nextID, {
        id: nextID,
        type: type.type,
        inputs: new Array(type.inputs).fill(false),
        outputs: new Array(type.outputs).fill(type.initialOutput),
        inputPins: new Array(type.inputs).fill(null),
        outputPins: new Array(type.outputs).fill(undefined).map(() => []),
        position: { x: 0, y: 0 }
    });

    wires.set(
        nextID,
        new Array(type.outputs).fill(undefined).map(() => [])
    );

    if (type.type === INPUT.type) {
        inputChips.push(nextID);
    } else if (type.type === OUTPUT.type) {
        outputChips.push(nextID);
    }

    nextID++;

    return nextID;
}

function deleteChip(chipID: ChipID): void {
    const chip = getChip(chipID);

    if (chip.type === INPUT.type) {
        inputChips.splice(inputChips.indexOf(chipID), 1);
    } else if (chip.type === OUTPUT.type) {
        outputChips.splice(outputChips.indexOf(chipID), 1);
    }

    for (let i = 0; i < chip.outputPins.length; i++) {
        for (let j = 0; j < chip.outputPins[i].length; j++) {
            disconnect({ chipID, pinID: i, isOutput: true }, chip.outputPins[i][j]);
        }
    }

    for (let i = 0; i < chip.inputPins.length; i++) {
        if (chip.inputPins[i] !== null) {
            disconnect(chip.inputPins[i]!, { chipID, pinID: i, isOutput: false });
        }
    }

    chips.delete(chipID);
    wires.delete(chipID);

    render();
}

function getChip(chipID: ChipID): Chip {
    if (!chips.has(chipID)) throw new Error("Chip does not exist");

    const chip = chips.get(chipID);

    if (chip === undefined) throw new Error("Chip is undefined");

    return chip;
}

function connect(from: Pin, to: Pin): void {
    getChip(from.chipID).outputPins[from.pinID].push(to);
    getChip(to.chipID).inputPins[to.pinID] = from;

    simulate(from.chipID);
}

function disconnect(from: Pin, to: Pin): void {
    deleteWire(from, to);

    const chip = getChip(from.chipID);

    chip.outputPins[from.pinID] = chip.outputPins[from.pinID].filter(
        (x) => x.chipID !== to.chipID || x.pinID !== to.pinID
    );

    getChip(to.chipID).inputPins[to.pinID] = null;
    getChip(to.chipID).inputs[to.pinID] = false;

    simulate(to.chipID);
}

function setInput(inputID: number, value: boolean): void {
    getChip(inputChips[inputID]).outputs[0] = value;

    simulate(inputChips[inputID]);
}

function simulate(fromChip: ChipID): void {
    let toUpdate: Set<ChipID> = new Set(recheckOscillators);
    toUpdate.add(fromChip);

    oscillators = new Set();

    let updates = 0;
    while (toUpdate.size > 0 && updates < MAX_UPDATES + OSCILLATION_CHECK_UPDATES) {
        updates++;

        const nextToUpdate: Set<ChipID> = new Set();

        for (const chipID of toUpdate) {
            const chip = getChip(chipID);

            if (chip.type === INPUT.type) {
                for (let i = 0; i < chip.outputPins[0].length; i++) {
                    const outputPin = chip.outputPins[0][i];

                    getChip(outputPin.chipID).inputs[outputPin.pinID] = chip.outputs[0];

                    nextToUpdate.add(outputPin.chipID);
                }
            } else if (chip.type === OUTPUT.type) {
                continue;
            } else if (chip.type === NAND.type) {
                const val = nand(chip.inputs[0], chip.inputs[1]);

                if (val !== chip.outputs[0] || updates === 1) {
                    if (updates > MAX_UPDATES) oscillators.add(JSON.stringify({ chipID, pinID: 0, isOutput: true }));

                    chip.outputs[0] = val;

                    for (let i = 0; i < chip.outputPins[0].length; i++) {
                        const outputPin = chip.outputPins[0][i];

                        getChip(outputPin.chipID).inputs[outputPin.pinID] = val;

                        nextToUpdate.add(outputPin.chipID);
                    }
                }
            }
        }

        toUpdate = nextToUpdate;
    }

    if (updates >= MAX_UPDATES + OSCILLATION_CHECK_UPDATES) {
        recheckOscillators.push(fromChip);
    } else {
        recheckOscillators = [];
    }

    render();
}

insertAddChipButton(INPUT);
insertAddChipButton(OUTPUT);
insertAddChipButton(NAND);

render();
