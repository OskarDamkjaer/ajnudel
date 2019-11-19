/**
 * Snake Bot script.
 */
const MapUtils = require("../domain/mapUtils.js");

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
    const map = mapState.getMap();
    const width = map.getWidth();
    const myCoords = getSnakePosition(myUserId, map);
    const maxPosition = width * map.getHeight();
    const safeContents = ["", "food"];
    const possibleDirections = ["UP", "DOWN", "LEFT", "RIGHT"];
    const occupiedTiles = getOccupiedMapTiles(map);

    const coordsAreDeadly = coordinate => {
        const { content } = quickTileAt({ coordinate });
        return safeContents.includes(content);
    };

    const scoreSort = (b, a) => a.score - b.score;
    const weights = {
        death: -99999,
        deathInTwo: -100,
        food: 1
    };

    const fillBois = coord => {
        const expandPositions = coord =>
            possibleDirections
            .map(dir => coordsAfterMove(dir, coord))
            .filter(c => coordsAreDeadly(c));

        const otherSnakesHeads = map
            .getSnakeInfos()
            .filter(a => a.getId() !== myUserId)
            .map(snakeInfo => snakeInfo.getPositions()[0])
            .filter(a => a)
            .map(p => translatePosition(p, width));

        const oneStep = otherSnakesHeads.map(expandPositions).reduce(flatten, []);
        const twoStep = oneStep.map(expandPositions).reduce(flatten, []);
        const possibleOtherSnakes = twoStep.map(c => translateCoordinate(c, width));

        // something something call stack exeeded
        const point = translateCoordinate(coord, width);
        let que = [point];
        let visited = [];
        let count = 0;

        while (que.length !== 0) {
            count += count;
            const currPos = que.pop();
            const currCoords = translatePosition(currPos, width);
            visited = visited.concat(currPos);

            if (visited.length > 100) {
                // make this 100 or more
                return count;
            }

            const newCoords = possibleDirections
                .map(dir => coordsAfterMove(dir, currCoords))
                .filter(c => coordsAreDeadly(c))
                .map(c => translateCoordinate(c, width))
                .filter(p => !visited.includes(p));
            const penalty = newCoords.reduce(
                (acc, curr) => (possibleOtherSnakes.includes(curr) ? acc + 1 : acc),
                0
            );
            // TODO någon form av penalty utan att utesluta
            //count -= penalty;
            que = que.concat(newCoords);
        }

        return count;
    };

    const alterScore = (scoreChange, opt) => ({
        ...opt,
        score: opt.score + scoreChange
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

    log(fillBois(myCoords));

    const bestDirection = possibleDirections
        .map(direction => {
            const first = coordsAfterMove(direction, myCoords);
            const second = coordsAfterMove(direction, first);

            return {
                direction,
                score: 0,
                coordsAfterMove: first,
                coordsAfterTwoMoves: second
            };
        })
        .map(opt =>
            alterScore(coordsAreDeadly(opt.coordsAfterMove) ? 0 : weights.death, opt)
        )
        .map(opt =>
            alterScore(
                coordsAreDeadly(opt.coordsAfterTwoMoves) ? 0 : weights.deathInTwo,
                opt
            )
        )
        .map(opt => alterScore(fillBois(opt.coordsAfterMove), opt))
        .map(debug("options"))
        .sort(scoreSort)[0].direction;

    log("I took:", bestDirection);
    const snakeBrainDump = {};
    snakeBrainDump.myCoords = myCoords;
    return {
        direction: bestDirection,
        debugData: snakeBrainDump
    };
}

function oldOnMapUpdated(mapState, myUserId) {
    const weights = {
        deathInOne: -99999,
        deathInTwo: -10,
        otherPpl: -1,
        food: 1
    };
    const safeContents = ["", "food"];
    const possibleDirections = ["UP", "DOWN", "LEFT", "RIGHT"];
    const debug = (msg = "") => it => log(msg, it) || it;
    const scoreSort = (b, a) => a.score - b.score;

    const myCoords = getSnakePosition(myUserId, map);
    const map = mapState.getMap();

    const otherSnakePositions = Object.entries(getSnakesCoordinates(map))
        .filter(([id, positions]) => id !== myUserId)
        .reduce((acc, [id, positions]) => acc.concat(positions), []);

    const sameXDir = otherSnakePositions.filter(({ x }) => x === myCoords.x);
    const sameYDir = otherSnakePositions.filter(({ y }) => y === myCoords.y);

    const tileAfterMove = (opt, coords, map) =>
        getTileInDirection(
            opt.direction,
            coordsAfterMove(opt.direction, coords),
            map
        );

    // {direction, score, rest} = option
    const bestDirection = possibleDirections
        .map(dir => ({ direction: dir, score: 0 }))
        .map(opt => ({
            ...opt,
            oneStep: getTileInDirection(opt.direction, myCoords, map)
        }))
        .map(opt => ({...opt, twoStep: tileAfterMove(opt, myCoords, map) }))
        .map(opt => ({
            ...opt,
            score: opt.score +
                (safeContents.includes(opt.oneStep.content) ? 0 : weights.deathInOne)
        }))
        .map(opt => ({
            ...opt,
            score: opt.score +
                (safeContents.includes(opt.twoStep.content) ? 0 : weights.deathInTwo)
        }))
        .map(debug("options"))
        .sort(scoreSort)[0].direction;

    log("I took:", bestDirection);
    const snakeBrainDump = {};
    snakeBrainDump.myCoords = myCoords;
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
        .isAlive ?
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