/**
 * Snake Bot script.
 */
const MapUtils = require("../domain/mapUtils.js");
const { performance } = require("perf_hooks");

let log = null; // Injected logger

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
// last direction
let inTunnel = false;
let trapped = false;

function onMapUpdated(mapState, myUserId) {
    const startTime = performance.now();
    const map = mapState.getMap();
    const width = map.getWidth();
    const myCoords = getSnakePosition(myUserId, map);
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

    const fill = (coords, deadSpot) => {
        shouldDie = false;
        const depth = dfs(coords, {}, 0, deadSpot);
        shouldDie = false; //Torktummlarprincipen
        return depth;
    };

    let shouldDie = false; //snyggare med closure
    const myDistance = 150;
    const nemDistance = 100;
    const dfs = (coords, visited, depth, deadSpot) => {
        const timeAlmostUp = performance.now() - startTime > 200;
        const pos = translateCoordinate(coords, width);
        const dejavu = visited[pos];
        const isDeadSpot = pos === deadSpot;
        let wantedDistance = myDistance;
        const hitBottom = depth === wantedDistance;
        let dead = !safeHere(coords);
        let couldBeTaken = translateCoordinates(othersAfterOne, width).includes(
            pos
        );
        if (depth > 1) {
            couldBeTaken =
                couldBeTaken ||
                translateCoordinates(othersAfterTwo, width).includes(pos);
        }
        if (depth > 2) {
            couldBeTaken =
                couldBeTaken ||
                translateCoordinates(othersAfterThree, width).includes(pos);
        }

        shouldDie = shouldDie || hitBottom;

        // avoid other snake thinking its instantly dead
        if (deadSpot) {
            couldBeTaken = false;
            dead = !safeHere(coords) && depth !== 0;
            wantedDistance = nemDistance;
        }

        if (
            hitBottom ||
            dead ||
            dejavu ||
            shouldDie ||
            couldBeTaken ||
            isDeadSpot ||
            timeAlmostUp
        ) {
            return depth;
        }
        visited[pos] = true;

        return Math.max(
            ...expandPositions(coords).map(c => dfs(c, visited, depth + 1, deadSpot)),
            0
        );
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
        takenSoon: -20000,
        trap: -10000,
        deathIn2: trapped ? 0 : -200,
        dubbleslit: trapped ? 0 : inTunnel ? -100 : -300,
        food: 1,
        othersWeight: -1,
        slitTolerance: 10,
        emptyTile: 1,
        removedFromNem: 2
    };

    const ortoDir = {
        UP: ["LEFT", "RIGHT"],
        DOWN: ["LEFT", "RIGHT"],
        LEFT: ["DOWN", "UP"],
        RIGHT: ["DOWN", "UP"]
    };

    const scoreTags = opt => ({
        ...opt,
        score: opt.tags.reduce((acc, curr) => acc + weights[curr], 0)
    });

    const customScore = (score, opt) => ({
        ...opt,
        score: opt.score + score
    });

    const { coords: nemesisHead } = otherSnakesHeads
        .map(coords => ({
            coords,
            dist: getManhattanDistance(coords, myCoords)
        }))
        .sort((a, b) => a.dist - b.dist)[0] || { coords: { x: -1, y: -1 } };

    const nemesisRoomSize = fill(nemesisHead, true);

    const bestOption = possibleDirections
        .map(direction => {
            const first = coordsAfterMove(direction, myCoords);
            const second = coordsAfterMove(direction, first);
            const roomSize = fill(first);
            const takenSoon = othersAfterOne.includes(first);
            const nemesisNewRoom = fill(
                nemesisHead,
                translateCoordinate(first, width)
            );
            const nemesisSecondRoom = fill(
                nemesisHead,
                translateCoordinate(second, width)
            );
            const removeNemesis = nemesisRoomSize - nemesisNewRoom;
            const removeNemesis2 = nemesisRoomSize - nemesisSecondRoom;

            const slitWidth = ortoDir[direction]
                .map(dir => {
                    const one = coordsAfterMove(dir, first);
                    const two = coordsAfterMove(dir, one);
                    return [one, two].map(safeHere);
                })
                .reduce(flatten, [])
                .filter(a => a).length;

            return {
                direction,
                tags: [],
                score: 0,
                coordsAfterMove: first,
                coordsAfterTwo: second,
                roomSize,
                takenSoon,
                slitWidth,
                removeNemesis,
                removeNemesis2
            };
        })
        .map(opt => addTag(!safeHere(opt.coordsAfterMove) && "death", opt))
        .map(opt => addTag(!safeHere(opt.coordsAfterTwo) && "deathIn2", opt))
        .map(opt => addTag(opt.takenSoon && "takenSoon", opt))
        .map(opt => addTag(opt.roomSize < 80 && "trap", opt))
        .map(opt => addTag(opt.slitWidth < 2 && "dubbleslit", opt))
        .map(scoreTags)
        .map(opt => customScore(opt.roomSize * weights.emptyTile, opt))
        .map(opt => customScore(opt.removeNemesis * weights.removedFromNem, opt))
        .map(opt =>
            customScore((opt.removeNemesis2 * weights.removedFromNem) / 2, opt)
        )
        .map(debug("options"))
        .sort(scoreSort)[0];

    const bestDirection = bestOption.direction;
    inTunnel = bestOption.tags.includes("dubbleslit");
    trapped = bestOption.tags.includes("trap");
    // TODO, check if going to be to slow and if so, don't do the call
    // TODO, prevent full on collission.
    // TODO, weights
    // TODO, check that allways takes best room
    // tood prevent snirklande längs väggar
    // TODo försölk gå mot kanten ju mer i mitten du är
    // todo fler djup på dfs men capa beräkningarna till att inte gå över tidne
    // Todo randoma om vi inte är i en slit
    log("I took:", bestDirection);
    const snakeBrainDump = {};
    snakeBrainDump.myCoords = myCoords;
    log("thinking took:", performance.now() - startTime);
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
    console.log(
        event.payload.playerRanks.find(({ playerName }) => playerName === "ajnudel")
        .alive ?
        "VICTORY" :
        "DEFEAT",
        event.payload.gameId
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