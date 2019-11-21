/**
 * Snake Bot script.
 */
const MapUtils = require("../domain/mapUtils.js");
const { performance } = require("perf_hooks");

let log = null; // Injected logger

const directionMovementDeltas = {
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 },
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 }
};

const {
    canSnakeMoveInDirection,
    getEuclidianDistance,
    getManhattanDistance,
    getOccupiedMapTiles,
    getSnakeCoordinates,
    getSnakeLength,
    getSnakePosition,
    getSnakesCoordinates,
    getTileAt,
    getTileInDirection,
    isCoordinateOutOfBounds,
    isTileAvailableForMovementTo,
    isWithinSquare,
    listCoordinatesContainingFood,
    listCoordinatesContainingObstacle,
    positionsToCoords,
    sortByClosestTo,
    translateCoordinate,
    translateCoordinates,
    translatePosition,
    translatePositions,
    coordsAfterMove
} = MapUtils;

const debug = (msg = "") => it => log(msg, it) || it;
const flatten = (acc, curr) => acc.concat(curr);

function onMapUpdated(mapState, myUserId) {
    const startTime = performance.now();
    const map = mapState.getMap();
    const width = map.getWidth();
    const myCoords = getSnakePosition(myUserId, map);
    const maxPosition = width * map.getHeight();
    const safeContents = ["", "food"];
    const possibleDirections = ["UP", "DOWN", "LEFT", "RIGHT"];
    const occupiedTiles = getOccupiedMapTiles(map);

    const safeHere = coordinate => {
        const { content } = quickTileAt({ coordinate });
        return safeContents.includes(content);
    };

    const scoreSort = (b, a) => a.score - b.score;

    const expandPositions = coord =>
        possibleDirections
        .map(dir => coordsAfterMove(dir, coord))
        .filter(c => safeHere(c));

    const otherSnakesHeads = map
        .getSnakeInfos()
        .filter(a => a.getId() !== myUserId)
        .map(snakeInfo => snakeInfo.getPositions()[0])
        .filter(a => a)
        .map(p => translatePosition(p, width));

    const othersAfterOne = otherSnakesHeads
        .map(expandPositions)
        .reduce(flatten, []);
    const othersAfterTwo = othersAfterOne
        .map(expandPositions)
        .reduce(flatten, []);
    const othersAfterThree = othersAfterTwo
        .map(expandPositions)
        .reduce(flatten, []);

    const avoidOthers = coord => {};

    let lastCount = 0;
    let totalVisited = [];

    const fillRoom = coord => {
        // we now use rooms even if they are easy to shut
        const point = translateCoordinate(coord, width);
        let que = [point];
        let visited = [];
        let count = 0;

        while (que.length !== 0) {
            count += 1;
            const currPos = que.pop();
            const currCoords = translatePosition(currPos, width);

            if (totalVisited.includes(currPos)) {
                console.log("room joined");
                return lastCount;
            }

            visited = visited.concat(currPos);
            if (count > 80) {
                // 300 might enable latency issues
                break;
            }

            const newCoords = expandPositions(currCoords)
                .filter(c => othersAfterOne.includes(c)) // count one step to be closed as closed
                .map(c => translateCoordinate(c, width))
                .filter(p => !visited.includes(p));

            que = que.concat(newCoords);
        }

        totalVisited = totalVisited.concat(visited);
        lastCount = count;
        return count;
    };

    const addTag = (tag, opt) => ({
        ...opt,
        tags: opt.tags.concat(tag).filter(a => a)
    });

    function quickTileAt({ position, coordinate }) {
        const c = coordinate || translatePosition(position, width);
        const p =
            position || position === 0 ?
            position :
            translateCoordinate(coordinate, width);
        if (isCoordinateOutOfBounds(c, map)) {
            return { content: "outofbounds" };
        }
        return occupiedTiles[p] || { content: "" };
    }

    const weights = {
        death: -99999,
        trap: -10000,
        deathIn2: -3,
        food: 1,
        othersWeight: -1,
        fill: 1
    };

    const setScore = opt => ({
        ...opt,
        score: opt.tags.reduce((acc, curr) => acc + weights[curr], 0)
    });

    const bestDirection = possibleDirections
        .map(direction => {
            const first = coordsAfterMove(direction, myCoords);
            const second = coordsAfterMove(direction, first);
            const roomSize = fillRoom(first);

            return {
                direction,
                tags: [],
                score: 0,
                coordsAfterMove: first,
                coordsAfterTwo: second,
                roomSize
            };
        })
        .map(opt => addTag(!safeHere(opt.coordsAfterMove) && "death", opt))
        .map(opt => addTag(!safeHere(opt.coordsAfterTwo) && "deathIn2", opt))
        .map(opt => addTag(opt.roomSize < 80 && "trap", opt))
        .map(setScore)
        .map(debug("options"))
        .sort(scoreSort)[0].direction;

    // TODO, check if going to be to slow and if so, don't do the call
    log("I took:", bestDirection);
    const snakeBrainDump = {};
    snakeBrainDump.myCoords = myCoords;
    console.log("thinking took:", performance.now() - startTime);
    return {
        direction: bestDirection,
        debugData: snakeBrainDump
    };
}

function bootStrap(logger) {
    log = logger;
}

function onGameEnded(event) {
    log("On Game Ended");
    log(event);
    // Implement as needed.
}

function onTournamentEnded(event) {
    log("On Tournament Ended");
    log(event);
    // Implement as needed.
}

function onSnakeDied(event) {
    log("On Snake Died");
    log(event);
    // Implement as needed.
}

function onGameStarted(event) {
    log("On Game Started");
    log(event);
    // Implement as needed.
}

function onGameResult(event) {
    log("On Game Result");
    log(event);
    log(
        event.payload.playerRanks.find(
            ({ playerName }) => playerName === "ajnudel"
        ),
        event.payload.playerRanks.find(({ playerName }) => playerName === "ajnudel")
        .alive ?
        "YOU WIN" :
        "YOU LOST"
    );
    // Implement as needed.
}

module.exports = {
    bootStrap,
    onGameEnded,
    onGameResult,
    onGameStarted,
    onMapUpdated,
    onSnakeDied,
    onTournamentEnded
};