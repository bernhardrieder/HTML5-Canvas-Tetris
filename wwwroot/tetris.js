// (c) Bernhard Rieder, Viktor Was

/**
 * we made use of:
 * https://www.w3schools.com/graphics/game_intro.asp
 * http://blog.sklambert.com/galaxian-html5-game/
 * http://code.bytespider.eu/post/21438674255/dirty-rectangles
 */

/* ~~~~~~ TODO SECTION ~~~~~~ */
//todo: create onscreen buttons or touch input? -> https://www.w3schools.com/graphics/game_controllers.asp
//todo: use images of tetris blocks instead of drawing a rectangle? -> https://www.w3schools.com/graphics/game_images.asp

/* ~~~~~~ actual game ~~~~~~ */

var dirtyRectangles = [];
var backgroundCanvas = document.getElementById("background");
var backgroundContext = backgroundCanvas.getContext("2d");
var fieldCanvas = document.getElementById("main");
var fieldCanvasContext = fieldCanvas.getContext("2d");
var lastLoopTime = 0;
var isGameOver = false;

function init() {
    //setup background canvas
    backgroundCanvas.width = window.innerWidth;
    backgroundCanvas.height = window.innerHeight;

    //setup main canvas
    fieldCanvas.width = window.innerWidth;
    fieldCanvas.height = window.innerHeight;

    //setup game loop
    var loop = function(time = 0) {
        var deltaTime = time - lastLoopTime;
        lastLoopTime = time;
        update(deltaTime);
        render();
        window.requestAnimationFrame(loop, backgroundCanvas);
    }
    //activate game loop
    window.requestAnimationFrame(loop, backgroundCanvas);

    //setup walls
    for (var x = 0; x <= grid.size.x + 1; ++x) {
        for (var y = 0; y <= grid.size.y; ++y) {
            if (x === 0 || x === grid.size.x + 1 || y === grid.size.y) {
                var block = new Block(y % 2 === 0 ? "grey" : "black");
                block.setCanvasPosition({ x: x * blockSize, y: y * blockSize });
                block.draw(backgroundContext);
            }
        }
    }

    //start actual game
    startGame();
}

function randomIntFromInterval(min, max) {
    return Math.floor(Math.random() * (max - min + 1) + min);
}

//https://stackoverflow.com/questions/1484506/random-color-generator
function getRandomColor() {
    var letters = '0123456789ABCDEF';
    var color = '#';
    for (var i = 0; i < 6; i++) {
        color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
}

var grid = {
    size: { x: 10, y: 20 },
    matrix: [],
    blocksOnField: [],
    activeBlockContainer: 0,
    spawnX: 0,

    init: function() {
        this.spawnX = this.size.x / 2;
        for (var x = 0; x < this.size.x; ++x) {
            this.matrix[x] = [];
            for (var y = 0; y < this.size.y; ++y)
                this.matrix[x][y] = undefined;
        }
    },

    getCanvasPositionFromGridPosition: function(x, y) {
        return {
            x: blockSize /*wall*/ + x * blockSize,
            y: y * blockSize
        }
    },

    spawnNewBlockContainer: function() {
        grid.spawnBlockContainer(new BlockContainer(getRandomColor(), blockContainer.normalL));
    },

    spawnBlockContainer: function(container = BlockContainer) {
        this.activeBlockContainer = container;
        container.init();

        var triggerGameOver = false;
        var spawnX = (this.size.x - container.blockMatrix.length) / 2;
        this.activeBlockContainer.upperLeftGridCornerPosition = { x: spawnX, y: 0 };
        for (var y = 0; y < container.blockMatrix[0].length; ++y) {
            //var rowBlockCount = 0;

            for (var x = 0; x < container.blockMatrix.length; ++x) {
                //rowBlockCount += container.blockMatrix[x][y];

                if (container.blockMatrix[container.currentRotation][x][y]) {
                    var block = new Block(container.color);
                    block.container = container;
                    container.blocks.push(block);
                    this.blocksOnField.push(block);


                    block.setCanvasPosition(this.getCanvasPositionFromGridPosition(spawnX + x, y));
                    if (this.matrix[spawnX + x][y]) {
                        triggerGameOver = true;
                    }
                    this.matrix[spawnX + x][y] = block;
                    block.gridPosition = { x: spawnX + x, y: y };
                }

            }
        }

        if (triggerGameOver) {
            gameOver();
        }

    },
    isMoveBlockDownPossible: function(block = Block) {
        //check if block can move
        if (block.gridPosition.y + 1 >= this.size.y) {
            return false;
        }

        var next = this.matrix[block.gridPosition.x][block.gridPosition.y + 1];
        if (next && next.container !== block.container) {
            return false;
        } 
        return true;
    },

    isMoveBlockSidewaysPossible: function (block = Block, toTheRight = false) {
        //check if block can move

        if (toTheRight && block.gridPosition.x + 1 >= this.size.x || !toTheRight && block.gridPosition.x - 1 < 0) {
            return false;
        }
        var posX = block.gridPosition.x + toTheRight ? 1 : -1;
        var next = this.matrix[posX][block.gridPosition.y];
        if (next && next.container !== block.container) {
            return false;
        }
        return true;
    },


    isBlockContainerRotationPossible: function (rotation) {
        var matrixOld = this.activeBlockContainer.blockMatrix[this.activeBlockContainer.currentRotation];
        var matrixNew = this.activeBlockContainer.blockMatrix[rotation];

        //get all current blocks and try to fit them into the other
        var testGridPositions = [];
        for (var x = this.activeBlockContainer.upperLeftGridCornerPosition.x, xTest = 0;
            x < this.activeBlockContainer.upperLeftGridCornerPosition.x + matrixNew.length;
            ++x, ++xTest) {
            for (var y = this.activeBlockContainer.upperLeftGridCornerPosition.y, yTest = 0;
                y < this.activeBlockContainer.upperLeftGridCornerPosition.y + matrixNew[0].length;
                ++y, ++yTest) {
                if (matrixNew[xTest][yTest] === 1) {
                    testGridPositions.push({ x: x, y: y });
                }
            }
        }

        var isPossible = true;
        testGridPositions.forEach(function(pos = { x, y }) {
            if (pos.x >= grid.size.x || pos.x < 0 || pos.y >= grid.size.y || pos.y < 0 || grid.matrix[pos.x][pos.y] && grid.matrix[pos.x][pos.y].container !== grid.activeBlockContainer) {
                isPossible &= false;
                return;
            }
        });

        return { isRotationPossible: isPossible, newGridPositions: testGridPositions };
    },

    moveActiveBlockContainerDown: function() {
        var canMove = true;
        this.activeBlockContainer.blocks.forEach(function(block = Block) {
            canMove &= grid.isMoveBlockDownPossible(block);
        });
        if (canMove) {
            ++this.activeBlockContainer.upperLeftGridCornerPosition.y; 
            this.activeBlockContainer.blocks.forEach(function(block = Block) {
                grid.matrix[block.gridPosition.x][block.gridPosition.y] =
                    undefined; //WHY THE FUCK DO I NEED TO CALL GRID.MATRIX AND CAN'T USE THIS.MATRIX??!??????
            });
            this.activeBlockContainer.blocks.forEach(function(block = Block) {
                block.move(true, false, false);
            });
            this.activeBlockContainer.blocks.forEach(function(block = Block) {
                grid.matrix[block.gridPosition.x][++block.gridPosition.y] = block;
            });
        } else {
            this.activeBlockContainer.blocks.forEach(function(block = Block) {
                block.container = undefined;
            });
            this.activeBlockContainer = undefined;
            checkForFullRow = true;
            //todo: move this to another location?
            this.spawnNewBlockContainer();
        }

    },

    moveActiveBlockContainerSideways: function(toTheRight = false) {
        var canMove = true;
        this.activeBlockContainer.blocks.forEach(function (block = Block) {
            canMove &= grid.isMoveBlockSidewaysPossible(block, toTheRight);
        });
        if (canMove) {
            if (toTheRight) {
                ++this.activeBlockContainer.upperLeftGridCornerPosition.x;
            } else {
                --this.activeBlockContainer.upperLeftGridCornerPosition.x;
            }
            this.activeBlockContainer.blocks.forEach(function (block = Block) {
                grid.matrix[block.gridPosition.x][block.gridPosition.y] = undefined; 
            });
            this.activeBlockContainer.blocks.forEach(function (block = Block) {
                block.move(false, toTheRight, !toTheRight);
            });
            this.activeBlockContainer.blocks.forEach(function (block = Block) {
                block.gridPosition.x += toTheRight ? 1 : -1;
                grid.matrix[block.gridPosition.x][block.gridPosition.y] = block;
            });
        } 
    },

    rotateActiveBlockContainer: function () {
        var rotation = (this.activeBlockContainer.currentRotation +1)% 4; // there are just 4 rotations possible
        var rotationPossibleAndGridPositions = grid.isBlockContainerRotationPossible(rotation);
        if (rotationPossibleAndGridPositions.isRotationPossible) {
            console.log("rotation is possible!");
            this.activeBlockContainer.currentRotation = rotation;
            this.activeBlockContainer.blocks.forEach(function (block = Block) {
                grid.matrix[block.gridPosition.x][block.gridPosition.y] = undefined;
            });
            var positions = rotationPossibleAndGridPositions.newGridPositions;
            for (var i = 0; i < positions.length; ++i) {
                grid.activeBlockContainer.blocks[i].setCanvasPosition(grid.getCanvasPositionFromGridPosition(positions[i].x, positions[i].y));
                grid.matrix[positions[i].x][positions[i].y] = grid.activeBlockContainer.blocks[i];
                grid.activeBlockContainer.blocks[i].gridPosition = { x: positions[i].x, y: positions[i].y };
            }
        }
    },

    //this is used for all blocks if a row will be cleared
    moveBlockDown: function(block) {
        //check if block can move
        if (!block || block.container ||
            block.gridPosition.y + 1 >= this.size.y ||
            this.matrix[block.gridPosition.x][block.gridPosition.y + 1]) {
            return;
        }

        this.matrix[block.gridPosition.x][block.gridPosition.y] = undefined;
        this.matrix[block.gridPosition.x][++block.gridPosition.y] = block;

        block.move(true, false,false);
    },

    debug: function () {
        var string = ""; 
        for (var y = 0; y < grid.size.y; ++y) {
            for (var x = 0; x < grid.size.x; ++x) {
                string += this.matrix[x][y] ? 1 : 0;
            }
            string += "\n";
        }
        console.log(string);
    }
    
}

var blockSize = 30;

function Block(color) {
    this.width = blockSize;
    this.height = blockSize;
    this.canvasPosition = { x: 100, y: 100 };
    this.dirty = true;
    this.container = undefined;
    this.gridPosition = { x: 0, y: 0 };
    this.color = color;

    this.setCanvasPosition = function ({ x, y }) {
        var originalX = this.canvasPosition.x;
        var originalY = this.canvasPosition.y;

        this.canvasPosition.x = x;
        this.canvasPosition.y = y;

        if (originalX !== this.canvasPosition.x || originalY !== this.canvasPosition.y) {
            this.dirty = true;

            // add this rectangle to the dirty rectangles array
            // note: it's the rectangle before the movement was made
            dirtyRectangles.push({
                x: originalX,
                y: originalY,
                width: this.width,
                height: this.height
            });
        }
    }
    this.draw = function(canvasContext) {
        canvasContext.fillStyle = this.color;
        canvasContext.fillRect(this.canvasPosition.x, this.canvasPosition.y, this.width, this.height);
        this.dirty = false;
    }

    this.destroy = function() {
        dirtyRectangles.push({
            x: this.canvasPosition.x,
            y: this.canvasPosition.y,
            width: this.width,
            height: this.height
        });
    }

    this.move = function(down = false, right = false, left = false) {
        var x = this.canvasPosition.x;
        var y = this.canvasPosition.y;

        if (down) {
            y += blockSize;
        }
        if (right) {
            x += blockSize;
        } else if (left) {
            x -= blockSize;
        }

        this.setCanvasPosition({x,y});
    }
}

function BlockContainer(color, params = blockContainerParams) {
    this.currentRotation = 0;
    this.color = color;
    this.blocks = [];
    this.blockMatrix = [];
    this.upperLeftGridCornerPosition = { x: 0, y: 0 };

    this.init = function() {
        for (var i = 0; i < params.rotationBlockMatrix.length; ++i) {
            this.blockMatrix[i] = [];
            for (var y = 0; y < params.rotationBlockMatrix[0].length; ++y) {
                this.blockMatrix[i][y] = [];
                for (var x = 0; x < params.rotationBlockMatrix[0][0].length; ++x)
                    this.blockMatrix[i][y][x] = undefined;
            }
        }

        //swap x and y! -> swapped axis makes it easier for container definition!

        for (var i = 0; i < params.rotationBlockMatrix.length; ++i) {
            for (var y = 0; y < params.rotationBlockMatrix[0].length; ++y) {
                for (var x = 0; x < params.rotationBlockMatrix[0][0].length; ++x) {
                    this.blockMatrix[i][y][x] = params.rotationBlockMatrix[i][x][y];
                }
            }
        }
    }
}

var blockContainerParams = {
    //you need to swap x and y!
    rotationBlockMatrix: [
        [
            [0, 0, 0, 0],
            [0, 0, 0, 0],
            [0, 0, 0, 0],
            [0, 0, 0, 0]
        ],
        [
            [0, 0, 0, 0],
            [0, 0, 0, 0],
            [0, 0, 0, 0],
            [0, 0, 0, 0]
        ],
        [
            [0, 0, 0, 0],
            [0, 0, 0, 0],
            [0, 0, 0, 0],
            [0, 0, 0, 0]
        ],
        [
            [0, 0, 0, 0],
            [0, 0, 0, 0],
            [0, 0, 0, 0],
            [0, 0, 0, 0]
        ]
    ]
}
var blockContainer = {
    quadratic: blockContainerParams,
    normalL: blockContainerParams,
    reversedL: blockContainerParams,
    I: blockContainerParams,
    normalS: blockContainerParams,
    reversedS: blockContainerParams,
    T: blockContainerParams
};
blockContainer.normalL.rotationBlockMatrix = [
    [
        [0, 0, 1, 0],
        [1, 1, 1, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0]
    ],
    [
        [0, 1, 0, 0],
        [0, 1, 0, 0],
        [0, 1, 1, 0],
        [0, 0, 0, 0]
    ],
    [
        [0, 0, 0, 0],
        [1, 1, 1, 0],
        [1, 0, 0, 0],
        [0, 0, 0, 0]
    ],
    [
        [1, 1, 0, 0],
        [0, 1, 0, 0],
        [0, 1, 0, 0],
        [0, 0, 0, 0]
    ]
];

function startGame() {
    //clear grid;
    grid.blocksOnField.forEach(function (block) {
        block.destroy();
    });
    grid.init();

    //reset game over
    isGameOver = false;

    //spawn first stone
    grid.spawnNewBlockContainer();
}

var automaticMoveDownTimespan =
    300; // I HAVE NO FUCKING CLUE HOW MUCH TIME THIS IS?! ->> cause a value of 300 is approx. around one second???
var elapsedTimeForAutomaticMoveDown = 0;

var clearRowActivated = false;
var clearRows = [];
var timeToClearRow = automaticMoveDownTimespan;
var elapsedTimeForClearRow = 0;
var checkForFullRow = false;

function update(deltaTime) {
    if (isGameOver) {
        if (KEY_STATUS.enter.pressed) {
            startGame();
        }
        return;
    }

    //should clear some rows?
    if (clearRowActivated) {
        elapsedTimeForClearRow += deltaTime;
        if (elapsedTimeForClearRow >= timeToClearRow) {
            var rows = clearRows.length;
            var minRow = grid.size.y;
            while (clearRows.length > 0) {
                var y = clearRows.pop();
                if (minRow < y) {
                    minRow = y;
                }
                for (var x = 0; x < grid.size.x; ++x) {
                    grid.matrix[x][y] = undefined;
                }
                var i = grid.blocksOnField.length;
                while (i--) {
                    if (grid.blocksOnField[i] && grid.blocksOnField[i].gridPosition.y === y) {
                        grid.blocksOnField[i].destroy();
                        grid.blocksOnField[i] = undefined;
                        grid.blocksOnField.splice(i, 1);
                    }
                }
            }
            //move all blocks down
            for (var y = minRow; y > 0; --y) {
                for (var x = 0; x < grid.size.x; ++x) {
                    if (grid.matrix[x][y]) {
                        grid.moveBlockDown(grid.matrix[x][y]);
                    }
                }
            }
            //grid.blocksOnField.forEach(function(block = Block) {
            //    for (var i = 0; i < rows; ++i) {
            //        if (block.gridPosition.y < minRow) {
            //            grid.moveBlockDown(block);
            //        }
            //    }
            //});
            clearRowActivated = false;
            elapsedTimeForClearRow = 0;
        }
    }
    if (checkForFullRow) {
        //check if there is a full row and destroy it!
        for (var y = 0; y < grid.size.y; ++y) {
            var count = 0;
            //count === x -> we can stop counting because there is a hole!
            for (var x = 0; x < grid.size.x && count === x; ++x) {
                count += grid.matrix[x][y] ? 1 : 0;
            }
            //did we find a full row?
            if (count === grid.size.x) {
                if ($.inArray(y, clearRows) === -1) {
                    //clear this row
                    clearRows.push(y);
                }
                clearRowActivated = true;
            }
        }
        checkForFullRow = false;
    }

    //automatic move down
    elapsedTimeForAutomaticMoveDown += deltaTime;
    if (elapsedTimeForAutomaticMoveDown >= automaticMoveDownTimespan) {
        grid.moveActiveBlockContainerDown();
        elapsedTimeForAutomaticMoveDown = 0;
    }


    //grid.debug();
    //key mapping - the held shit doesn't work -> our update method deltatime is too fast -> consider other method!
    if (KEY_STATUS.left.pressed && !inputLock.left) {
        moveLeft();
    } else if (KEY_STATUS.right.pressed && !inputLock.right) {
        moveRight();
    } else if (KEY_STATUS.up.pressed && !inputLock.rotate) {
        rotate();
    } else if (KEY_STATUS.down.pressed && !inputLock.drop) {
        drop();
    }

    inputLock.left = KEY_STATUS.left.pressed;
    inputLock.right = KEY_STATUS.right.pressed;
    inputLock.rotate = KEY_STATUS.up.pressed;
    //inputLock.drop = KEY_STATUS.down.pressed;

    //grid.debug();
}

var inputLock = {
    left: false,
    right: false,
    drop: false,
    rotate: false
}

function render() {
    //clear dirty rectangles
    while (dirtyRectangles.length > 0) {
        var rect = dirtyRectangles.pop();

        // clear this rectangle from the canvas
        fieldCanvasContext.clearRect(rect.x, rect.y, rect.width, rect.height);
    }

    //render dirty blocks 
    grid.blocksOnField.forEach(function(block) {
        if (block.dirty) {
            block.draw(fieldCanvasContext);
        }
    });

}

function rotate() {
    grid.rotateActiveBlockContainer();
}

function drop() {
    grid.moveActiveBlockContainerDown();
    elapsedTimeForAutomaticMoveDown = 0;
}

function moveLeft() {
    grid.moveActiveBlockContainerSideways(false);
}

function moveRight() {
    grid.moveActiveBlockContainerSideways(true);
}

function gameOver() {
    console.log("GAME OVER!");
    isGameOver = true;
}

/* ~~~~~~ controller code from galaxian game ~~~~~~ */
// The keycodes that will be mapped when a user presses a button.
// Original code by Doug McInnes
KEY_CODES = {
    13: "enter",
    37: "left",
    38: "up",
    39: "right",
    40: "down"
}

// Creates the array to hold the KEY_CODES and sets all their values
// to false. Checking true/flase is the quickest way to check status
// of a key press and which one was pressed when determining
// when to move and which direction.
KEY_STATUS = {
    pressed: false
};
for (code in KEY_CODES) {
    KEY_STATUS[KEY_CODES[code]] = [false, false];
}
/**
 * Sets up the document to listen to onkeydown events (fired when
 * any key on the keyboard is pressed down). When a key is pressed,
 * it sets the appropriate direction to true to let us know which
 * key it was.
 */
document.onkeydown = function(e) {
    // Firefox and opera use charCode instead of keyCode to
    // return which key was pressed.
    var keyCode = (e.keyCode) ? e.keyCode : e.charCode;
    if (KEY_CODES[keyCode]) {
        e.preventDefault();

        KEY_STATUS[KEY_CODES[keyCode]].pressed = true;

        //console.log()
    }
}
/**
 * Sets up the document to listen to ownkeyup events (fired when
 * any key on the keyboard is released). When a key is released,
 * it sets teh appropriate direction to false to let us know which
 * key it was.
 */
document.onkeyup = function(e) {
    var keyCode = (e.keyCode) ? e.keyCode : e.charCode;
    if (KEY_CODES[keyCode]) {
        e.preventDefault();
        KEY_STATUS[KEY_CODES[keyCode]].pressed = false;
    }
}