/**
 * Snake Bot script.
 */
const MapUtils = require('../domain/mapUtils.js');

let log = null; // Injected logger

function onMapUpdated(mapState, myUserId) {
    const map = mapState.getMap();
    const possibleDirections = ['UP', 'DOWN', 'LEFT', 'RIGHT']
    const snakeBrainDump = {}; // Optional debug information about the snakes current state of mind.
    const {
        getSnakePosition,
        canSnakeMoveInDirection,
        getTileInDirection,
        isCoordinateOutOfBounds,
        listCoordinatesContainingObstacle,
        coordsAfterMove
    } = MapUtils;

    // 1. Where's what etc.
    const myCoords = getSnakePosition(myUserId, map);
    log('I am here:', myCoords);

    const debug = (msg = "") => it => log(msg, it) || it
    const deathTiles = ['outofbounds', 'snakebody']

    const moveObj = possibleDirections
        .map(direction => ({ direction, oneStep: getTileInDirection(direction, myCoords, map) }))
        .map(obj => ({...obj, twoStep: getTileInDirection(obj.direction, coordsAfterMove(obj.direction, myCoords), map) }))
        .map(debug("haj du"))
        .filter(({ oneStep }) => !deathTiles.includes(oneStep.content))
        .map(debug("after one"))
        .filter(({ twoStep }) => !deathTiles.includes(twoStep.content))
        .map(debug())[0]
        // sort by best moves
    const bestDirection = moveObj ? moveObj.direction : "DOWN" // we are dead
    log('I took:', bestDirection)

    snakeBrainDump.myCoords = myCoords;

    // log("obs", listCoordinatesContainingObstacle(myCoords, map))
    // log(listCoordinatesContainingObstacle(myCoords, map))


    // 2. Do some nifty planning...
    // (Tip: see MapUtils for some off-the-shelf navigation aid.

    // 3. Then shake that snake!
    return {
        direction: bestDirection,
        debugData: snakeBrainDump
    };
}

function bootStrap(logger) {
    log = logger;
}

function onGameEnded(event) {
    log('On Game Ended');
    log(event);
    // Implement as needed.
}

function onTournamentEnded(event) {
    log('On Tournament Ended');
    log(event);
    // Implement as needed.
}

function onSnakeDied(event) {
    log('On Snake Died');
    log(event);
    // Implement as needed.
}

function onGameStarted(event) {
    log('On Game Started');
    log(event);
    // Implement as needed.
}

function onGameResult(event) {
    log('On Game Result');
    log(event);
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