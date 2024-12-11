/* GLOBAL CONSTANTS AND VARIABLES */

/* assignment specific globals */

//time variables

/* json values
0 = my ship
1 - 12 = ewnemy ships
13 = my missile
14-19 = enemy missiles

*/

var totalTime = 0;
var keydownW = 0;
var keydownA = 0;
var keydownS = 0;
var keydownD = 0;
var fov = 0.3


const INPUT_TRIANGLES_URL = "triangles.json"; // triangles file loc
const INPUT_ELLIPSOIDS_URL = "ellipsoids.json"; // ellipsoids file loc
var defaultEye = vec3.fromValues(0.0,-0.4,-1.8); // default eye position in world space
var defaultCenter = vec3.fromValues(0.0,0.0,0.0); // default view direction in world space
var defaultUp = vec3.fromValues(0,1,0); // default view up vector
var lightAmbient = vec3.fromValues(1,1,1); // default light ambient emission
var lightDiffuse = vec3.fromValues(1,1,1); // default light diffuse emission
var lightSpecular = vec3.fromValues(1,1,1); // default light specular emission
var lightPosition = vec3.fromValues(-0.0,0.0,-1.0); // default light position
var rotateTheta = Math.PI/50; // how much to rotate models by with each key press

/* webgl and geometry data */
var gl = null; // the all powerful gl object. It's all here folks!
var inputTriangles = []; // the triangle data as loaded from input files
var numTriangleSets = 0; // how many triangle sets in input scene
var inputEllipsoids = []; // the ellipsoid data as loaded from input files
var numEllipsoids = 0; // how many ellipsoids in the input scene

var vertexBuffers = []; // this contains vertex coordinate lists by set, in triples
var normalBuffers = []; // this contains normal component lists by set, in triples
var triSetSizes = []; // this contains the size of each triangle set
var triangleBuffers = []; // lists of indices into vertexBuffers by set, in triples
// _P1: declare uv buffer
var uvBuffers = [];

/* shader parameter locations */
var vPosAttribLoc; // where to put position for vertex shader
var vNormAttribLoc; //where to put normal for vertex shader
var mMatrixULoc; // where to put model matrix for vertex shader
var pvmMatrixULoc; // where to put project model view matrix for vertex shader
var ambientULoc; // where to put ambient reflecivity for fragment shader
var diffuseULoc; // where to put diffuse reflecivity for fragment shader
var specularULoc; // where to put specular reflecivity for fragment shader
var shininessULoc; // where to put specular exponent for fragment shader
//Parker's UV texture
var uvPosAttribLoc; //where to pout the uv position for vertex shader
var uSamplerLocation;
var mixingModeULoc;
var mixingModeState = 0;
var alphaULoc;

/* interaction variables */
var Eye = vec3.clone(defaultEye); // eye position in world space
var Center = vec3.clone(defaultCenter); // view direction in world space
var Up = vec3.clone(defaultUp); // view up vector in world space
var viewDelta = 0; // how much to displace view with each key press

// ASSIGNMENT HELPER FUNCTIONS

// get the JSON file from the passed URL
function getJSONFile(url,descr) {
    try {
        if ((typeof(url) !== "string") || (typeof(descr) !== "string"))
            throw "getJSONFile: parameter not a string";
        else {
            var httpReq = new XMLHttpRequest(); // a new http request
            httpReq.open("GET",url,false); // init the request
            httpReq.send(null); // send the request
            var startTime = Date.now();
            while ((httpReq.status !== 200) && (httpReq.readyState !== XMLHttpRequest.DONE)) {
                if ((Date.now()-startTime) > 3000)
                    break;
            } // until its loaded or we time out after three seconds
            if ((httpReq.status !== 200) || (httpReq.readyState !== XMLHttpRequest.DONE))
                throw "Unable to open "+descr+" file!";
            else
                return JSON.parse(httpReq.response); 
        } // end if good params
    } // end try    
    
    catch(e) {
        console.log(e);
        return(String.null);
    }
} // end get input json file

// does stuff when keys are pressed
function handleKeyDown(event) {
    
    const modelEnum = {TRIANGLES: "triangles", ELLIPSOID: "ellipsoid"}; // enumerated model type
    const dirEnum = {NEGATIVE: -1, POSITIVE: 1}; // enumerated rotation direction
    
    function highlightModel(modelType,whichModel) {
        if (handleKeyDown.modelOn != null)
            handleKeyDown.modelOn.on = false;
        handleKeyDown.whichOn = whichModel;
        if (modelType == modelEnum.TRIANGLES)
            handleKeyDown.modelOn = inputTriangles[whichModel]; 
        else
            handleKeyDown.modelOn = inputEllipsoids[whichModel]; 
        handleKeyDown.modelOn.on = true; 
    } // end highlight model
    
    function translateModel(offset) {
        if (handleKeyDown.modelOn != null)
            vec3.add(handleKeyDown.modelOn.translation,handleKeyDown.modelOn.translation,offset);
    } // end translate model

    function rotateModel(axis,direction) {
        if (handleKeyDown.modelOn != null) {
            var newRotation = mat4.create();

            mat4.fromRotation(newRotation,direction*rotateTheta,axis); // get a rotation matrix around passed axis
            vec3.transformMat4(handleKeyDown.modelOn.xAxis,handleKeyDown.modelOn.xAxis,newRotation); // rotate model x axis tip
            vec3.transformMat4(handleKeyDown.modelOn.yAxis,handleKeyDown.modelOn.yAxis,newRotation); // rotate model y axis tip
        } // end if there is a highlighted model
    } // end rotate model
    
    // set up needed view params
    var lookAt = vec3.create(), viewRight = vec3.create(), temp = vec3.create(); // lookat, right & temp vectors
    lookAt = vec3.normalize(lookAt,vec3.subtract(temp,Center,Eye)); // get lookat vector
    viewRight = vec3.normalize(viewRight,vec3.cross(temp,lookAt,Up)); // get view right vector
    
    // highlight static variables
    handleKeyDown.whichOn = handleKeyDown.whichOn == undefined ? -1 : handleKeyDown.whichOn; // nothing selected initially
    handleKeyDown.modelOn = handleKeyDown.modelOn == undefined ? null : handleKeyDown.modelOn; // nothing selected initially

    switch (event.code) {
        
        // model selection
        case "Space": 
            if (handleKeyDown.modelOn != null)
                handleKeyDown.modelOn.on = false; // turn off highlighted model
            handleKeyDown.modelOn = null; // no highlighted model
            handleKeyDown.whichOn = -1; // nothing highlighted
            break;
        case "ArrowRight": // select next triangle set
            highlightModel(modelEnum.TRIANGLES,(handleKeyDown.whichOn+1) % numTriangleSets);
            break;
        case "ArrowLeft": // select previous triangle set
            highlightModel(modelEnum.TRIANGLES,(handleKeyDown.whichOn > 0) ? handleKeyDown.whichOn-1 : numTriangleSets-1);
            break;
        case "ArrowUp": // select next ellipsoid
            highlightModel(modelEnum.ELLIPSOID,(handleKeyDown.whichOn+1) % numEllipsoids);
            break;
        case "ArrowDown": // select previous ellipsoid
            highlightModel(modelEnum.ELLIPSOID,(handleKeyDown.whichOn > 0) ? handleKeyDown.whichOn-1 : numEllipsoids-1);
            break;
            
        // view change
        case "KeyA": // translate view left, rotate left with shift
            Center = vec3.add(Center,Center,vec3.scale(temp,viewRight,viewDelta));
            if (!event.getModifierState("Shift"))
                Eye = vec3.add(Eye,Eye,vec3.scale(temp,viewRight,viewDelta));
            break;
        case "KeyB": // notify glsl of a light/texture blending mode\
            //change the mixing mode
            switch (mixingModeState){
                case 0:
                    mixingModeState = 1;
                    break;
                case 1:
                    mixingModeState = 2;
                    break;
                case 2:
                    mixingModeState = 0;
                    break;
            }
            gl.uniform1f(mixingModeULoc, mixingModeState);
            break;
        case "KeyD": // translate view right, rotate right with shift
            Center = vec3.add(Center,Center,vec3.scale(temp,viewRight,-viewDelta));
            if (!event.getModifierState("Shift"))
                Eye = vec3.add(Eye,Eye,vec3.scale(temp,viewRight,-viewDelta));
            break;
        case "KeyS": // translate view backward, rotate up with shift
            if (event.getModifierState("Shift")) {
                Center = vec3.add(Center,Center,vec3.scale(temp,Up,viewDelta));
                Up = vec3.cross(Up,viewRight,vec3.subtract(lookAt,Center,Eye)); /* global side effect */
            } else {
                Eye = vec3.add(Eye,Eye,vec3.scale(temp,lookAt,-viewDelta));
                Center = vec3.add(Center,Center,vec3.scale(temp,lookAt,-viewDelta));
            } // end if shift not pressed
            break;
        case "KeyW": // translate view forward, rotate down with shift
            if (event.getModifierState("Shift")) {
                Center = vec3.add(Center,Center,vec3.scale(temp,Up,-viewDelta));
                Up = vec3.cross(Up,viewRight,vec3.subtract(lookAt,Center,Eye)); /* global side effect */
            } else {
                Eye = vec3.add(Eye,Eye,vec3.scale(temp,lookAt,viewDelta));
                Center = vec3.add(Center,Center,vec3.scale(temp,lookAt,viewDelta));
            } // end if shift not pressed
            break;
        case "KeyQ": // translate view up, rotate counterclockwise with shift
            if (event.getModifierState("Shift"))
                Up = vec3.normalize(Up,vec3.add(Up,Up,vec3.scale(temp,viewRight,-viewDelta)));
            else {
                Eye = vec3.add(Eye,Eye,vec3.scale(temp,Up,viewDelta));
                Center = vec3.add(Center,Center,vec3.scale(temp,Up,viewDelta));
            } // end if shift not pressed
            break;
        case "KeyE": // translate view down, rotate clockwise with shift
            if (event.getModifierState("Shift"))
                Up = vec3.normalize(Up,vec3.add(Up,Up,vec3.scale(temp,viewRight,viewDelta)));
            else {
                Eye = vec3.add(Eye,Eye,vec3.scale(temp,Up,-viewDelta));
                Center = vec3.add(Center,Center,vec3.scale(temp,Up,-viewDelta));
            } // end if shift not pressed
            break;
        case "Escape": // reset view to default
            Eye = vec3.copy(Eye,defaultEye);
            Center = vec3.copy(Center,defaultCenter);
            Up = vec3.copy(Up,defaultUp);
            break;
            
        // model transformation
        case "KeyK": // translate left, rotate left with shift
            if (event.getModifierState("Shift"))
                rotateModel(Up,dirEnum.NEGATIVE);
            else
                translateModel(vec3.scale(temp,viewRight,viewDelta));
            break;
        case "Semicolon": // translate right, rotate right with shift
            if (event.getModifierState("Shift"))
                rotateModel(Up,dirEnum.POSITIVE);
            else
                translateModel(vec3.scale(temp,viewRight,-viewDelta));
            break;
        case "KeyL": // translate backward, rotate up with shift
            if (event.getModifierState("Shift"))
                rotateModel(viewRight,dirEnum.POSITIVE);
            else
                translateModel(vec3.scale(temp,lookAt,-viewDelta));
            break;
        case "KeyO": // translate forward, rotate down with shift
            if (event.getModifierState("Shift"))
                rotateModel(viewRight,dirEnum.NEGATIVE);
            else
                translateModel(vec3.scale(temp,lookAt,viewDelta));
            break;
        case "KeyI": // translate up, rotate counterclockwise with shift 
            if (event.getModifierState("Shift"))
                rotateModel(lookAt,dirEnum.POSITIVE);
            else
                translateModel(vec3.scale(temp,Up,viewDelta));
            break;
        case "KeyP": // translate down, rotate clockwise with shift
            if (event.getModifierState("Shift"))
                rotateModel(lookAt,dirEnum.NEGATIVE);
            else
                translateModel(vec3.scale(temp,Up,-viewDelta));
            break;
        case "Backspace": // reset model transforms to default
            for (var whichTriSet=0; whichTriSet<numTriangleSets; whichTriSet++) {
                vec3.set(inputTriangles[whichTriSet].translation,0,0,0);
                vec3.set(inputTriangles[whichTriSet].xAxis,1,0,0);
                vec3.set(inputTriangles[whichTriSet].yAxis,0,1,0);
            } // end for all triangle sets
            for (var whichEllipsoid=0; whichEllipsoid<numEllipsoids; whichEllipsoid++) {
                vec3.set(inputEllipsoids[whichEllipsoid].translation,0,0,0);
                vec3.set(inputEllipsoids[whichTriSet].xAxis,1,0,0);
                vec3.set(inputEllipsoids[whichTriSet].yAxis,0,1,0);
            } // end for all ellipsoids
            break;
    } // end switch
} // end handleKeyDown

// set up the webGL environment
function setupWebGL() {
    
    // Set up keys
    // document.onkeydown = handleKeyDown; // call this when key pressed

      // Get the image canvas, render an image in it
     var imageCanvas = document.getElementById("myImageCanvas"); // create a 2d canvas
      var cw = imageCanvas.width, ch = imageCanvas.height; 
      imageContext = imageCanvas.getContext("2d"); 
      var bkgdImage = new Image(); 
      //bkgdImage.crossOrigin = "Anonymous";
      bkgdImage.src = "stars.jpg";
      bkgdImage.onload = function(){
          var iw = bkgdImage.width, ih = bkgdImage.height;
          imageContext.drawImage(bkgdImage,0,0,iw,ih,0,0,cw,ch);   
     } // end onload callback
    
     // create a webgl canvas and set it up
     var webGLCanvas = document.getElementById("myWebGLCanvas"); // create a webgl canvas
     gl = webGLCanvas.getContext("webgl"); // get a webgl object from it
     try {
       if (gl == null) {
         throw "unable to create gl context -- is your browser gl ready?";
       } else {
         //gl.clearColor(0.0, 0.0, 0.0, 1.0); // use black when we clear the frame buffer
         gl.clearDepth(1.0); // use max when we clear the depth buffer
         gl.enable(gl.DEPTH_TEST); // use hidden surface removal (with zbuffering)
       }
     } // end try
     
     catch(e) {
       console.log(e);
     } // end catch
} // end setupWebGL

var listOfTextures = ["abe.png", "billie.jpg", "earth.png", "glass.gif", "leaf.small.png", "retro.jpg",
    "rocktile.jpg", "sky.jpg", "stars.jpg", "tree.png", "transparent.png", "green_outline.png"];

//load textures, pixels at first with actual models being loded in
function loadTextures() {

    for(var i = 0; i < listOfTextures.length; i++){
        var textureName = listOfTextures[i];

        gl.activeTexture(gl.TEXTURE0 + i); //switch to correct active texture

        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        // gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    
        const pixelTex = new Uint8Array([100, 0, 0, 255]);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, pixelTex);
        if(textureName != false){
        const image = new Image();
            // onload function was modifed from MDN texture tutorial
            //https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/Tutorial/Using_textures_in_WebGL
            image.onload = function() {
                // alert(this.index);
                gl.activeTexture(gl.TEXTURE0+this.index); //switch to correct active texture
                gl.bindTexture(gl.TEXTURE_2D, texture); //already bound no need to bind again
                gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
                
            };
            image.crossOrigin = "Anonymous";
            image.index = i;
            // image.src = "https://ajgavane.github.io/Computer_Graphics/" + textureName;
            image.src = "./" + textureName;
        }
    }
}

//part of mdn tutorial cited above
function isPowerOf2(value) {
    return (value & (value - 1)) == 0;
}

// read models in, load them into webgl buffers
function loadModels() {

    // make an ellipsoid, with numLongSteps longitudes.
    // start with a sphere of radius 1 at origin
    // Returns verts, tris and normals.
    function makeEllipsoid(currEllipsoid,numLongSteps) {

        try {
            if (numLongSteps % 2 != 0)
                throw "in makeSphere: uneven number of longitude steps!";
            else if (numLongSteps < 4)
                throw "in makeSphere: number of longitude steps too small!";
            else { // good number longitude steps
            
                console.log("ellipsoid xyz: "+ ellipsoid.x +" "+ ellipsoid.y +" "+ ellipsoid.z);
                

                // _P1:
                var ellipsoidUVs = [0,0]; //start with south pole uv

                // make vertices
                var ellipsoidVertices = [0,-1,0]; // vertices to return, init to south pole
                var angleIncr = (Math.PI+Math.PI) / numLongSteps; // angular increment 
                var latLimitAngle = angleIncr * (Math.floor(numLongSteps/4)-1); // start/end lat angle
                var latRadius, latY; // radius and Y at current latitude
                for (var latAngle=-latLimitAngle; latAngle<=latLimitAngle; latAngle+=angleIncr) {
                    latRadius = Math.cos(latAngle); // radius of current latitude
                    latY = Math.sin(latAngle); // height at current latitude
                    for (var longAngle=0; longAngle<2*Math.PI; longAngle+=angleIncr){ // for each long
                        //push point
                        ellipsoidVertices.push(latRadius*Math.sin(longAngle),latY,latRadius*Math.cos(longAngle));
                        ellipsoidUVs.push(longAngle/(2*Math.PI), (latAngle+Math.PI/2)/Math.PI); //add uv
                    }
                } // end for each latitude

                ellipsoidUVs.push(1, 1); //finish with north pole uv

                ellipsoidVertices.push(0,1,0); // add north pole
                ellipsoidVertices = ellipsoidVertices.map(function(val,idx) { // position and scale ellipsoid
                    switch (idx % 3) { //val in this case is the offset
                        case 0: // x
                            return(val*currEllipsoid.a+currEllipsoid.x);
                        case 1: // y
                            return(val*currEllipsoid.b+currEllipsoid.y);
                        case 2: // z
                            return(val*currEllipsoid.c+currEllipsoid.z);
                    } // end switch
                });

                // make normals using the ellipsoid gradient equation
                // resulting normals are unnormalized: we rely on shaders to normalize
                var ellipsoidNormals = ellipsoidVertices.slice(); // start with a copy of the transformed verts
                ellipsoidNormals = ellipsoidNormals.map(function(val,idx) { // calculate each normal
                    switch (idx % 3) {
                        case 0: // x
                            return(2/(currEllipsoid.a*currEllipsoid.a) * (val-currEllipsoid.x));
                        case 1: // y
                            return(2/(currEllipsoid.b*currEllipsoid.b) * (val-currEllipsoid.y));
                        case 2: // z
                            return(2/(currEllipsoid.c*currEllipsoid.c) * (val-currEllipsoid.z));
                    } // end switch
                });
                
                // make triangles, from south pole to middle latitudes to north pole
                var ellipsoidTriangles = []; // triangles to return
                for (var whichLong=1; whichLong<numLongSteps; whichLong++) // south pole
                    ellipsoidTriangles.push(0,whichLong,whichLong+1);
                ellipsoidTriangles.push(0,numLongSteps,1); // longitude wrap tri
                var llVertex; // lower left vertex in the current quad
                for (var whichLat=0; whichLat<(numLongSteps/2 - 2); whichLat++) { // middle lats
                    for (var whichLong=0; whichLong<numLongSteps-1; whichLong++) {
                        llVertex = whichLat*numLongSteps + whichLong + 1;
                        ellipsoidTriangles.push(llVertex,llVertex+numLongSteps,llVertex+numLongSteps+1);
                        ellipsoidTriangles.push(llVertex,llVertex+numLongSteps+1,llVertex+1);
                    } // end for each longitude
                    ellipsoidTriangles.push(llVertex+1,llVertex+numLongSteps+1,llVertex+2);
                    ellipsoidTriangles.push(llVertex+1,llVertex+2,llVertex-numLongSteps+2);
                } // end for each latitude
                for (var whichLong=llVertex+2; whichLong<llVertex+numLongSteps+1; whichLong++) // north pole
                    ellipsoidTriangles.push(whichLong,ellipsoidVertices.length/3-1,whichLong+1);
                ellipsoidTriangles.push(ellipsoidVertices.length/3-2,ellipsoidVertices.length/3-1,
                                        ellipsoidVertices.length/3-numLongSteps-1); // longitude wrap
            } // end if good number longitude steps
            return({vertices:ellipsoidVertices, normals:ellipsoidNormals, uvs:ellipsoidUVs, triangles:ellipsoidTriangles});
        } // end try
        
        catch(e) {
            console.log(e);
        } // end catch
    } // end make ellipsoid
    
    inputTriangles =  getJSONFile(INPUT_TRIANGLES_URL,"triangles"); // read in the triangle data

    try {
        if (inputTriangles == String.null)
            throw "Unable to load triangles file!";
        else {
            var whichSetVert; // index of vertex in current triangle set
            var whichSetTri; // index of triangle in current triangle set
            var vtxToAdd; // vtx coords to add to the coord array
            var normToAdd; // vtx normal to add to the coord array
            var uvToAdd; // uv coords to add to the uv arry
            var triToAdd; // tri indices to add to the index array
            var maxCorner = vec3.fromValues(Number.MIN_VALUE,Number.MIN_VALUE,Number.MIN_VALUE); // bbox corner
            var minCorner = vec3.fromValues(Number.MAX_VALUE,Number.MAX_VALUE,Number.MAX_VALUE); // other corner
        
            // process each triangle set to load webgl vertex and triangle buffers
            numTriangleSets = inputTriangles.length; // remember how many tri sets
            for (var whichSet=0; whichSet<numTriangleSets; whichSet++) { // for each tri set
                
                // set up hilighting, modeling translation and rotation
                inputTriangles[whichSet].center = vec3.fromValues(0,0,0);  // center point of tri set
                inputTriangles[whichSet].on = false; // not highlighted
                inputTriangles[whichSet].translation = vec3.fromValues(0,0,0); // no translation
                inputTriangles[whichSet].xAxis = vec3.fromValues(1,0,0); // model X axis
                inputTriangles[whichSet].yAxis = vec3.fromValues(0,1,0); // model Y axis 

                // set up the vertex and normal arrays, define model center and axes
                inputTriangles[whichSet].glVertices = []; // flat coord list for webgl
                inputTriangles[whichSet].glNormals = []; // flat normal list for webgl
                inputTriangles[whichSet].glUVs = []; // flat normal list for webgl
                var numVerts = inputTriangles[whichSet].vertices.length; // num vertices in tri set
                for (whichSetVert=0; whichSetVert<numVerts; whichSetVert++) { // verts in set
                    vtxToAdd = inputTriangles[whichSet].vertices[whichSetVert]; // get vertex to add
                    normToAdd = inputTriangles[whichSet].normals[whichSetVert]; // get normal to add
                    uvToAdd = inputTriangles[whichSet].uvs[whichSetVert]; // get iv to add

                    inputTriangles[whichSet].glVertices.push(vtxToAdd[0],vtxToAdd[1],vtxToAdd[2]); // put coords in set coord list
                    inputTriangles[whichSet].glNormals.push(normToAdd[0],normToAdd[1],normToAdd[2]); // put normal in set coord list
                    inputTriangles[whichSet].glUVs.push(uvToAdd[0], uvToAdd[1]);
                    vec3.max(maxCorner,maxCorner,vtxToAdd); // update world bounding box corner maxima
                    vec3.min(minCorner,minCorner,vtxToAdd); // update world bounding box corner minima
                    vec3.add(inputTriangles[whichSet].center,inputTriangles[whichSet].center,vtxToAdd); // add to ctr sum
                } // end for vertices in set
                vec3.scale(inputTriangles[whichSet].center,inputTriangles[whichSet].center,1/numVerts); // avg ctr sum

                // send the vertex coords and normals to webGL
                vertexBuffers[whichSet] = gl.createBuffer(); // init empty webgl set vertex coord buffer
                gl.bindBuffer(gl.ARRAY_BUFFER,vertexBuffers[whichSet]); // activate that buffer
                gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(inputTriangles[whichSet].glVertices),gl.STATIC_DRAW); // data in
                normalBuffers[whichSet] = gl.createBuffer(); // init empty webgl set normal component buffer
                gl.bindBuffer(gl.ARRAY_BUFFER,normalBuffers[whichSet]); // activate that buffer
                gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(inputTriangles[whichSet].glNormals),gl.STATIC_DRAW); // data in
               
                // _P1:
                uvBuffers[whichSet] = gl.createBuffer(); 
                gl.bindBuffer(gl.ARRAY_BUFFER,uvBuffers[whichSet]); // activate that buffer
                gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(inputTriangles[whichSet].glUVs),gl.STATIC_DRAW); //assign

                // set up the triangle index array, adjusting indices across sets
                inputTriangles[whichSet].glTriangles = []; // flat index list for webgl
                triSetSizes[whichSet] = inputTriangles[whichSet].triangles.length; // number of tris in this set
                for (whichSetTri=0; whichSetTri<triSetSizes[whichSet]; whichSetTri++) {
                    triToAdd = inputTriangles[whichSet].triangles[whichSetTri]; // get tri to add
                    inputTriangles[whichSet].glTriangles.push(triToAdd[0],triToAdd[1],triToAdd[2]); // put indices in set list
                } // end for triangles in set

                // send the triangle indices to webGL
                triangleBuffers.push(gl.createBuffer()); // init empty triangle index buffer
                gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, triangleBuffers[whichSet]); // activate that buffer
                gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(inputTriangles[whichSet].glTriangles),gl.STATIC_DRAW); // data in

            } // end for each triangle set 
        
            inputEllipsoids =getJSONFile(INPUT_ELLIPSOIDS_URL,"ellipsoids"); // read in the ellipsoids


            if (inputEllipsoids == String.null)
                throw "Unable to load ellipsoids file!";
            else {
                
                // init ellipsoid highlighting, translation and rotation; update bbox
                var ellipsoid; // current ellipsoid
                var ellipsoidModel; // current ellipsoid triangular model
                var temp = vec3.create(); // an intermediate vec3
                var minXYZ = vec3.create(), maxXYZ = vec3.create();  // min/max xyz from ellipsoid
                numEllipsoids = inputEllipsoids.length; // remember how many ellipsoids
                for (var whichEllipsoid=0; whichEllipsoid<numEllipsoids; whichEllipsoid++) {
                    
                    // set up various stats and transforms for this ellipsoid
                    ellipsoid = inputEllipsoids[whichEllipsoid];
                    ellipsoid.on = false; // ellipsoids begin without highlight
                    ellipsoid.translation = vec3.fromValues(0,0,0); // ellipsoids begin without translation
                    ellipsoid.xAxis = vec3.fromValues(1,0,0); // ellipsoid X axis
                    ellipsoid.yAxis = vec3.fromValues(0,1,0); // ellipsoid Y axis 
                    ellipsoid.center = vec3.fromValues(ellipsoid.x,ellipsoid.y,ellipsoid.z); // locate ellipsoid ctr
                    vec3.set(minXYZ,ellipsoid.x-ellipsoid.a,ellipsoid.y-ellipsoid.b,ellipsoid.z-ellipsoid.c); 
                    vec3.set(maxXYZ,ellipsoid.x+ellipsoid.a,ellipsoid.y+ellipsoid.b,ellipsoid.z+ellipsoid.c); 
                    vec3.min(minCorner,minCorner,minXYZ); // update world bbox min corner
                    vec3.max(maxCorner,maxCorner,maxXYZ); // update world bbox max corner

                    // make the ellipsoid model
                    ellipsoidModel = makeEllipsoid(ellipsoid,32);
    
                    // send the ellipsoid vertex coords and normals to webGL
                    vertexBuffers.push(gl.createBuffer()); // init empty webgl ellipsoid vertex coord buffer
                    gl.bindBuffer(gl.ARRAY_BUFFER,vertexBuffers[vertexBuffers.length-1]); // activate that buffer
                    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(ellipsoidModel.vertices),gl.STATIC_DRAW); // data in
                    normalBuffers.push(gl.createBuffer()); // init empty webgl ellipsoid vertex normal buffer
                    gl.bindBuffer(gl.ARRAY_BUFFER,normalBuffers[normalBuffers.length-1]); // activate that buffer
                    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(ellipsoidModel.normals),gl.STATIC_DRAW); // data in
        
                    // _P1:
                    uvBuffers.push(gl.createBuffer()); // init empty webgl ellipsoid vertex normal buffer
                    gl.bindBuffer(gl.ARRAY_BUFFER,uvBuffers[uvBuffers.length-1]); // activate that buffer
                    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(ellipsoidModel.uvs),gl.STATIC_DRAW); // data in


                    triSetSizes.push(ellipsoidModel.triangles.length);
    
                    // send the triangle indices to webGL
                    triangleBuffers.push(gl.createBuffer()); // init empty triangle index buffer
                    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, triangleBuffers[triangleBuffers.length-1]); // activate that buffer
                    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(ellipsoidModel.triangles),gl.STATIC_DRAW); // data in
                } // end for each ellipsoid
                
                viewDelta = vec3.length(vec3.subtract(temp,maxCorner,minCorner)) / 100; // set global
            } // end if ellipsoid file loaded
        } // end if triangle file loaded
    } // end try 
    
    catch(e) {
        console.log(e);
    } // end catch
} // end load models

// setup the webGL shaders
function setupShaders() {
    
    // define vertex shader in essl using es6 template strings
    var vShaderCode = /*glsl*/`
        attribute vec3 aVertexPosition; // vertex position
        attribute vec3 aVertexNormal; // vertex normal
        attribute vec2 aVertexTextureUV; //vertex uv
        
        uniform mat4 umMatrix; // the model matrix
        uniform mat4 upvmMatrix; // the project view model matrix
        
        varying vec3 vWorldPos; // interpolated world position of vertex
        varying vec3 vVertexNormal; // interpolated normal for frag shader
        varying vec2 uvPosition;

        void main(void) {
            
            // vertex texture
            uvPosition = aVertexTextureUV;

            // vertex position
            vec4 vWorldPos4 = umMatrix * vec4(aVertexPosition, 1.0);
            vWorldPos = vec3(vWorldPos4.x,vWorldPos4.y,vWorldPos4.z);
            gl_Position = upvmMatrix * vec4(aVertexPosition, 1.0);

            // vertex normal (assume no non-uniform scale)
            vec4 vWorldNormal4 = umMatrix * vec4(aVertexNormal, 0.0);
            vVertexNormal = normalize(vec3(vWorldNormal4.x,vWorldNormal4.y,vWorldNormal4.z)); 
        }
    `;
    
    // define fragment shader in essl using es6 template strings
    var fShaderCode = /*glsl*/`
        precision mediump float; // set float to medium precision

        // eye location
        uniform vec3 uEyePosition; // the eye's position in world
        
        // light properties
        uniform vec3 uLightAmbient; // the light's ambient color
        uniform vec3 uLightDiffuse; // the light's diffuse color
        uniform vec3 uLightSpecular; // the light's specular color
        uniform vec3 uLightPosition; // the light's position
        
        // texture properties
        varying vec2 uvPosition;
        uniform sampler2D uSampler;
        
        // material properties
        uniform vec3 uAmbient; // the ambient reflectivity
        uniform vec3 uDiffuse; // the diffuse reflectivity
        uniform vec3 uSpecular; // the specular reflectivity
        uniform float uShininess; // the specular exponent
        uniform float uAlpha; // the specular exponent

        //mixing mode property
        uniform float uMixingMode;
        
        // geometry properties
        varying vec3 vWorldPos; // world xyz of fragment
        varying vec3 vVertexNormal; // normal of fragment
            
        void main(void) {
        
            // ambient term
            vec3 ambient = uAmbient*uLightAmbient; 
            
            // diffuse term
            vec3 normal = normalize(vVertexNormal); 
            vec3 light = normalize(uLightPosition - vWorldPos);
            float lambert = max(0.0,dot(normal,light));
            vec3 diffuse = uDiffuse*uLightDiffuse*lambert; // diffuse term
            
            // specular term
            vec3 eye = normalize(uEyePosition - vWorldPos);
            vec3 halfVec = normalize(light+eye);
            float highlight = pow(max(0.0,dot(normal,halfVec)),uShininess);
            vec3 specular = uSpecular*uLightSpecular*highlight; // specular term
            
            // combine to output color
            vec3 colorOut = ambient + diffuse + specular; // no specular yet
            //gl_FragColor = vec4(colorOut, 1.0); 
            vec2 whyIsItReversed = vec2(1.0-uvPosition.x, 1.0-uvPosition.y);
            vec4 colorTexture = texture2D(uSampler, whyIsItReversed);
            //at this point colorOut represents Cf and colorTexture represents Ct
            vec4 color;         

            /* remove texture stuff
            if(uMixingMode == 0.0){
                color = colorTexture;
            }else if(uMixingMode == 1.0){
                color = vec4(colorOut.x*colorTexture.x,
                    colorOut.y*colorTexture.y,
                    colorOut.z*colorTexture.z,
                    colorTexture.w);
            }else if(uMixingMode == 2.0){
                color = vec4(colorOut.x*colorTexture.x,
                    colorOut.y*colorTexture.y,
                    colorOut.z*colorTexture.z,
                    uAlpha*colorTexture.w);
            }
                    */
                // color = vec4(colorOut, 1);
                color = (vec4(colorOut, 1) * (1.0-uAlpha)) + (colorTexture*uAlpha);
                // color = vec4(colorOut.x + colorTexture.x,
                //     colorOut.y + colorTexture.y,
                //     colorOut.z + colorTexture.z,
                //     uAlpha + colorTexture.w);

            if(color.a == 0.0)
                discard;
            gl_FragColor = color;
            //gl_FragColor = vec4(uvPosition, 0.0, 1.0); //uv map
        }
    `;
    
    try {
        var fShader = gl.createShader(gl.FRAGMENT_SHADER); // create frag shader
        gl.shaderSource(fShader,fShaderCode); // attach code to shader
        gl.compileShader(fShader); // compile the code for gpu execution

        var vShader = gl.createShader(gl.VERTEX_SHADER); // create vertex shader
        gl.shaderSource(vShader,vShaderCode); // attach code to shader
        gl.compileShader(vShader); // compile the code for gpu execution
            
        if (!gl.getShaderParameter(fShader, gl.COMPILE_STATUS)) { // bad frag shader compile
            throw "error during fragment shader compile: " + gl.getShaderInfoLog(fShader);  
            gl.deleteShader(fShader);
        } else if (!gl.getShaderParameter(vShader, gl.COMPILE_STATUS)) { // bad vertex shader compile
            throw "error during vertex shader compile: " + gl.getShaderInfoLog(vShader);  
            gl.deleteShader(vShader);
        } else { // no compile errors
            var shaderProgram = gl.createProgram(); // create the single shader program
            gl.attachShader(shaderProgram, fShader); // put frag shader in program
            gl.attachShader(shaderProgram, vShader); // put vertex shader in program
            gl.linkProgram(shaderProgram); // link program into gl context

            if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) { // bad program link
                throw "error during shader program linking: " + gl.getProgramInfoLog(shaderProgram);
            } else { // no shader program link errors
                gl.useProgram(shaderProgram); // activate shader program (frag and vert)
                
                // locate and enable vertex attributes
                vPosAttribLoc = gl.getAttribLocation(shaderProgram, "aVertexPosition"); // ptr to vertex pos attrib
                gl.enableVertexAttribArray(vPosAttribLoc); // connect attrib to array
                vNormAttribLoc = gl.getAttribLocation(shaderProgram, "aVertexNormal"); // ptr to vertex normal attrib
                gl.enableVertexAttribArray(vNormAttribLoc); // connect attrib to array
                // _P1: uv positions for vertices
                uvPosAttribLoc = gl.getAttribLocation(shaderProgram, "aVertexTextureUV");
                gl.enableVertexAttribArray(uvPosAttribLoc); 
                
                // locate vertex uniforms
                mMatrixULoc = gl.getUniformLocation(shaderProgram, "umMatrix"); // ptr to mmat
                pvmMatrixULoc = gl.getUniformLocation(shaderProgram, "upvmMatrix"); // ptr to pvmmat
                
                // locate fragment uniforms
                var eyePositionULoc = gl.getUniformLocation(shaderProgram, "uEyePosition"); // ptr to eye position
                var lightAmbientULoc = gl.getUniformLocation(shaderProgram, "uLightAmbient"); // ptr to light ambient
                var lightDiffuseULoc = gl.getUniformLocation(shaderProgram, "uLightDiffuse"); // ptr to light diffuse
                var lightSpecularULoc = gl.getUniformLocation(shaderProgram, "uLightSpecular"); // ptr to light specular
                var lightPositionULoc = gl.getUniformLocation(shaderProgram, "uLightPosition"); // ptr to light position
                ambientULoc = gl.getUniformLocation(shaderProgram, "uAmbient"); // ptr to ambient
                diffuseULoc = gl.getUniformLocation(shaderProgram, "uDiffuse"); // ptr to diffuse
                specularULoc = gl.getUniformLocation(shaderProgram, "uSpecular"); // ptr to specular
                shininessULoc = gl.getUniformLocation(shaderProgram, "uShininess"); // ptr to shininess
                
                // pass global constants into fragment uniforms
                gl.uniform3fv(eyePositionULoc,Eye); // pass in the eye's position
                gl.uniform3fv(lightAmbientULoc,lightAmbient); // pass in the light's ambient emission
                gl.uniform3fv(lightDiffuseULoc,lightDiffuse); // pass in the light's diffuse emission
                gl.uniform3fv(lightSpecularULoc,lightSpecular); // pass in the light's specular emission
                gl.uniform3fv(lightPositionULoc,lightPosition); // pass in the light's position
                
                uSamplerLocation = gl.getUniformLocation(shaderProgram, 'uSampler');
                gl.uniform1i(uSamplerLocation, 0);
                mixingModeULoc = gl.getUniformLocation(shaderProgram, "uMixingMode");
                gl.uniform1f(mixingModeULoc, 0);
                alphaULoc = gl.getUniformLocation(shaderProgram, "uAlpha"); // ptr to shininess

                gl.enable(gl.BLEND);
                gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
                // gl.depthMask(false);
            } // end if no shader program link errors
        } // end if no compile errors
    } // end try 
    
    catch(e) {
        console.log(e);
    } // end catch
} // end setup shaders

// render the loaded model
function renderModels() {
    // console.log("Tiue is " + Date.now() + "\n");
     gl.enable(gl.DEPTH_TEST);
    // construct the model transform matrix, based on model state
    function makeModelTransform(currModel) {
        var zAxis = vec3.create(), sumRotation = mat4.create(), temp = mat4.create(), negCtr = vec3.create();

        // move the model to the origin
        mat4.fromTranslation(mMatrix,vec3.negate(negCtr,currModel.center)); 
        
        //scale
        if(currModel.scale){
            mat4.multiply(mMatrix,mat4.fromScaling(temp,currModel.scale),mMatrix); // S(1.2) * T(-ctr)
        }
        
        // rotate the model to current interactive orientation
        vec3.normalize(zAxis,vec3.cross(zAxis,currModel.xAxis,currModel.yAxis)); // get the new model z axis
        mat4.set(sumRotation, // get the composite rotation
            currModel.xAxis[0], currModel.yAxis[0], zAxis[0], 0,
            currModel.xAxis[1], currModel.yAxis[1], zAxis[1], 0,
            currModel.xAxis[2], currModel.yAxis[2], zAxis[2], 0,
            0, 0,  0, 1);
        mat4.multiply(mMatrix,sumRotation,mMatrix); // R(ax) * S(1.2) * T(-ctr)
        
        // translate back to model center
        mat4.multiply(mMatrix,mat4.fromTranslation(temp,currModel.center),mMatrix); // T(ctr) * R(ax) * S(1.2) * T(-ctr)

        // translate model to current interactive orientation
        mat4.multiply(mMatrix,mat4.fromTranslation(temp,currModel.translation),mMatrix); // T(pos)*T(ctr)*R(ax)*S(1.2)*T(-ctr)
        
    } // end make model transform
    
    // var hMatrix = mat4.create(); // handedness matrix
    var pMatrix = mat4.create(); // projection matrix
    var vMatrix = mat4.create(); // view matrix
    var mMatrix = mat4.create(); // model matrix
    var pvMatrix = mat4.create(); // hand * proj * view matrices
    var pvmMatrix = mat4.create(); // hand * proj * view * model matrices
    
    // window.requestAnimationFrame(renderModels); // set up frame render callback
    
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); // clear frame/depth buffers
    
    // set up projection and view
    // mat4.fromScaling(hMatrix,vec3.fromValues(-1,1,1)); // create handedness matrix
    mat4.perspective(pMatrix,fov*Math.PI,1,0.1,10); // create projection matrix
    mat4.lookAt(vMatrix,Eye,Center,Up); // create view matrix
    mat4.multiply(pvMatrix,pvMatrix,pMatrix); // projection
    mat4.multiply(pvMatrix,pvMatrix,vMatrix); // projection * view
    

    gl.depthMask(true); 
    //DRAW OPAQUES
    {
        // render each triangle set
        var currSet; // the tri set and its material properties
        for (var whichTriSet=0; whichTriSet<numTriangleSets; whichTriSet++) {
            currSet = inputTriangles[whichTriSet];
            
            if(currSet.material.alpha == 1.0){
                // make model transform, add to view project
                makeModelTransform(currSet);
                mat4.multiply(pvmMatrix,pvMatrix,mMatrix); // project * view * model
                gl.uniformMatrix4fv(mMatrixULoc, false, mMatrix); // pass in the m matrix
                gl.uniformMatrix4fv(pvmMatrixULoc, false, pvmMatrix); // pass in the hpvm matrix
                
                // reflectivity: feed to the fragment shader
                gl.uniform3fv(ambientULoc,currSet.material.ambient); // pass in the ambient reflectivity
                gl.uniform3fv(diffuseULoc,currSet.material.diffuse); // pass in the diffuse reflectivity
                gl.uniform3fv(specularULoc,currSet.material.specular); // pass in the specular reflectivity
                gl.uniform1f(shininessULoc,currSet.material.n); // pass in the specular exponent
                gl.uniform1f(alphaULoc,currSet.material.alpha);
                
                // vertex buffer: activate and feed into vertex shader
                gl.bindBuffer(gl.ARRAY_BUFFER,vertexBuffers[whichTriSet]); // activate
                gl.vertexAttribPointer(vPosAttribLoc,3,gl.FLOAT,false,0,0); // feed
                gl.bindBuffer(gl.ARRAY_BUFFER,normalBuffers[whichTriSet]); // activate
                gl.vertexAttribPointer(vNormAttribLoc,3,gl.FLOAT,false,0,0); // feed
                gl.bindBuffer(gl.ARRAY_BUFFER,uvBuffers[whichTriSet]); // activate
                gl.vertexAttribPointer(uvPosAttribLoc,2,gl.FLOAT,false,0,0); // feed

                //which texture to use
                var posInList = listOfTextures.indexOf(currSet.material.texture);
                if(currSet.material.texture=="green_outline.png")
                    console.log(posInList);
                if(posInList > -1)
                    gl.uniform1i(uSamplerLocation, posInList);

                // triangle buffer: activate and render
                gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,triangleBuffers[whichTriSet]); // activate
                gl.drawElements(gl.TRIANGLES,3*triSetSizes[whichTriSet],gl.UNSIGNED_SHORT,0); // render
            }
            
        } // end for each triangle set
        
        // render each ellipsoid
        // var ellipsoid, instanceTransform = mat4.create(); // the current ellipsoid and material
        
        // for (var whichEllipsoid=0; whichEllipsoid<numEllipsoids; whichEllipsoid++) {
        //     ellipsoid = inputEllipsoids[whichEllipsoid];
            
        //     if(ellipsoid.alpha == 1.0){
        //         // define model transform, premult with pvmMatrix, feed to vertex shader
        //         makeModelTransform(ellipsoid);
        //         pvmMatrix = mat4.multiply(pvmMatrix,pvMatrix,mMatrix); // premultiply with pv matrix
        //         gl.uniformMatrix4fv(mMatrixULoc, false, mMatrix); // pass in model matrix
        //         gl.uniformMatrix4fv(pvmMatrixULoc, false, pvmMatrix); // pass in project view model matrix

        //         // reflectivity: feed to the fragment shader
        //         gl.uniform3fv(ambientULoc,ellipsoid.ambient); // pass in the ambient reflectivity
        //         gl.uniform3fv(diffuseULoc,ellipsoid.diffuse); // pass in the diffuse reflectivity
        //         gl.uniform3fv(specularULoc,ellipsoid.specular); // pass in the specular reflectivity
        //         gl.uniform1f(shininessULoc,ellipsoid.n); // pass in the specular exponent
        //         gl.uniform1f(alphaULoc,ellipsoid.alpha);

        //         gl.bindBuffer(gl.ARRAY_BUFFER,vertexBuffers[numTriangleSets+whichEllipsoid]); // activate vertex buffer
        //         gl.vertexAttribPointer(vPosAttribLoc,3,gl.FLOAT,false,0,0); // feed vertex buffer to shader
        //         gl.bindBuffer(gl.ARRAY_BUFFER,normalBuffers[numTriangleSets+whichEllipsoid]); // activate normal buffer
        //         gl.vertexAttribPointer(vNormAttribLoc,3,gl.FLOAT,false,0,0); // feed normal buffer to shader
                
        //         // _P1: bind buffers 
        //         gl.bindBuffer(gl.ARRAY_BUFFER,uvBuffers[numTriangleSets+whichEllipsoid]); 
        //         gl.vertexAttribPointer(uvPosAttribLoc,2,gl.FLOAT,false,0,0); //size 2 for vec2
        //         //which texture to use
        //         var posInList = listOfTextures.indexOf(ellipsoid.texture);
        //         gl.uniform1i(uSamplerLocation, posInList);

        //         gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,triangleBuffers[numTriangleSets+whichEllipsoid]); // activate tri buffer
                
        //         // draw a transformed instance of the ellipsoid
        //         gl.drawElements(gl.TRIANGLES,triSetSizes[numTriangleSets+whichEllipsoid],gl.UNSIGNED_SHORT,0); // render
        //     }
        // } // end for each ellipsoid
    }

    // gl.depthMask(false);
    //DRAW transparency
    {

        for (var whichTriSet=0; whichTriSet<numTriangleSets; whichTriSet++) {
            var currSet = inputTriangles[whichTriSet];

            currSet.distanceFromEye = vec3.distance(Eye, currSet.center);
            currSet.originalIndex = whichTriSet;
        }

        var cloneTris = inputTriangles.slice(0);
        //sort ellipsoids by distance
        cloneTris.sort(function(a, b){
            return b.distanceFromEye - a.distanceFromEye ;
        });

        // render each triangle set
        for (var whichTriSet=0; whichTriSet<numTriangleSets; whichTriSet++) {
            var currSet = cloneTris[whichTriSet];
            
            if(currSet.material.alpha < 1.0){
                // make model transform, add to view project
                makeModelTransform(currSet);
                mat4.multiply(pvmMatrix,pvMatrix,mMatrix); // project * view * model
                gl.uniformMatrix4fv(mMatrixULoc, false, mMatrix); // pass in the m matrix
                gl.uniformMatrix4fv(pvmMatrixULoc, false, pvmMatrix); // pass in the hpvm matrix
                
                // reflectivity: feed to the fragment shader
                gl.uniform3fv(ambientULoc,currSet.material.ambient); // pass in the ambient reflectivity
                gl.uniform3fv(diffuseULoc,currSet.material.diffuse); // pass in the diffuse reflectivity
                gl.uniform3fv(specularULoc,currSet.material.specular); // pass in the specular reflectivity
                gl.uniform1f(shininessULoc,currSet.material.n); // pass in the specular exponent
                gl.uniform1f(alphaULoc,currSet.material.alpha);
                
                // vertex buffer: activate and feed into vertex shader
                gl.bindBuffer(gl.ARRAY_BUFFER,vertexBuffers[currSet.originalIndex]); // activate
                gl.vertexAttribPointer(vPosAttribLoc,3,gl.FLOAT,false,0,0); // feed
                gl.bindBuffer(gl.ARRAY_BUFFER,normalBuffers[currSet.originalIndex]); // activate
                gl.vertexAttribPointer(vNormAttribLoc,3,gl.FLOAT,false,0,0); // feed
                gl.bindBuffer(gl.ARRAY_BUFFER,uvBuffers[currSet.originalIndex]); // activate
                gl.vertexAttribPointer(uvPosAttribLoc,2,gl.FLOAT,false,0,0); // feed

                //which texture to use
                var posInList = listOfTextures.indexOf(currSet.material.texture);
                //console.log(posInList);
                gl.uniform1i(uSamplerLocation, posInList);

                // triangle buffer: activate and render
                gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,triangleBuffers[currSet.originalIndex]); // activate
                gl.drawElements(gl.TRIANGLES,3*triSetSizes[currSet.originalIndex],gl.UNSIGNED_SHORT, 0); // render
            }
            
        } // end for each triangle set
        
        // // render each ellipsoid
        // var ellipsoid, instanceTransform = mat4.create(); // the current ellipsoid and material
    
        // //give each ellipsoid a distance
        // for (var whichEllipsoid=0; whichEllipsoid<numEllipsoids; whichEllipsoid++) {
        //     ellipsoid = inputEllipsoids[whichEllipsoid];
        //     ellipsoid.distanceFromEye = vec3.distance(Eye, ellipsoid.center);
        //     ellipsoid.originalIndex = whichEllipsoid;
        // }
        
        // var clone = inputEllipsoids.slice(0);
        // //sort ellipsoids by distance
        // clone.sort(function(a, b){
        //     return b.distanceFromEye - a.distanceFromEye ;
        // });

        // for (var whichEllipsoid=0; whichEllipsoid<numEllipsoids; whichEllipsoid++) {
        //     ellipsoid = clone[whichEllipsoid];
            
        //     if(ellipsoid.alpha < 1.0){
        //         // define model transform, premult with pvmMatrix, feed to vertex shader
        //         makeModelTransform(ellipsoid);
        //         pvmMatrix = mat4.multiply(pvmMatrix,pvMatrix,mMatrix); // premultiply with pv matrix
        //         gl.uniformMatrix4fv(mMatrixULoc, false, mMatrix); // pass in model matrix
        //         gl.uniformMatrix4fv(pvmMatrixULoc, false, pvmMatrix); // pass in project view model matrix

        //         // reflectivity: feed to the fragment shader
        //         gl.uniform3fv(ambientULoc,ellipsoid.ambient); // pass in the ambient reflectivity
        //         gl.uniform3fv(diffuseULoc,ellipsoid.diffuse); // pass in the diffuse reflectivity
        //         gl.uniform3fv(specularULoc,ellipsoid.specular); // pass in the specular reflectivity
        //         gl.uniform1f(shininessULoc,ellipsoid.n); // pass in the specular exponent
        //         gl.uniform1f(alphaULoc,ellipsoid.alpha);

        //         gl.bindBuffer(gl.ARRAY_BUFFER,vertexBuffers[numTriangleSets+ellipsoid.originalIndex]); // activate vertex buffer
        //         gl.vertexAttribPointer(vPosAttribLoc,3,gl.FLOAT,false,0,0); // feed vertex buffer to shader
        //         gl.bindBuffer(gl.ARRAY_BUFFER,normalBuffers[numTriangleSets+ellipsoid.originalIndex]); // activate normal buffer
        //         gl.vertexAttribPointer(vNormAttribLoc,3,gl.FLOAT,false,0,0); // feed normal buffer to shader
                
        //         // _P1: bind buffers 
        //         gl.bindBuffer(gl.ARRAY_BUFFER,uvBuffers[numTriangleSets+ellipsoid.originalIndex]); 
        //         gl.vertexAttribPointer(uvPosAttribLoc,2,gl.FLOAT,false,0,0); //size 2 for vec2
        //         //which texture to use
        //         var posInList = listOfTextures.indexOf(ellipsoid.texture);
        //         gl.uniform1i(uSamplerLocation, posInList);

        //         gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,triangleBuffers[numTriangleSets+ellipsoid.originalIndex]); // activate tri buffer
                
        //         // draw a transformed instance of the ellipsoid
        //         gl.drawElements(gl.TRIANGLES,triSetSizes[numTriangleSets+ellipsoid.originalIndex],gl.UNSIGNED_SHORT,0); // render
        //     }
        // } // end for each ellipsoid
    }
} // end render model


// Enemy movement as a block with time-based smoothness
let lastTimestamp = 0;
var randShipDown = [-1,-1];
var enemyTimer = [0.0,0.0];
var enemySent = false;
var elapsedTime = 0.0;

var lastMissileFired = [false, false, false, false, false, false];


function animateEnemies(timestamp) {
    if (!lastTimestamp) lastTimestamp = timestamp; // Initialize the timestamp on the first frame

    elapsedTime = (timestamp - lastTimestamp) / 1000; // Time elapsed since the last frame in seconds

    const amplitude = 0.1;  // Amplitude of the sinusoidal movement
    const frequency = 1.0;  // Frequency of the oscillation
    const offset = amplitude * Math.sin(2 * Math.PI * frequency * elapsedTime); // Calculate the shared sinusoidal offset
    for(let i = 14; i <= 19; i++)
        inputTriangles[i].scale = vec3.fromValues(0.1,0.7,0.1);
    

    // enemyTimer += 
    var howLongToReachBottom = 2;
    if((elapsedTime-enemyTimer[1]) > howLongToReachBottom && enemySent == false){
        enemyTimer[0] = elapsedTime;

        var findDownShip = () => {
            var shipAliveArr = [];
            for(let i = 1; i <= 6; i++) {
                if(!inputTriangles[i].isDead && randShipDown[0] != i) {
                    shipAliveArr.push(i);
                }
            }

            for(let i = 7; i <= 12; i++) {
                if(!inputTriangles[i].isDead && randShipDown[0] != i && inputTriangles[i-6].isDead) {
                    shipAliveArr.push(i);
                }
            }
            
            return shipAliveArr[Math.floor(Math.random() * shipAliveArr.length)]
        }

        randShipDown[0] = findDownShip();
        
        setTimeout(() => {
            randShipDown[1] = findDownShip();
            enemyTimer[1] = elapsedTime;
        }, 1000);
        enemySent = true;
    }
    

    const enemyDropVelocity = 0.5;  

    for (let i = 1; i < 13; i++) {
        // Base positions for the block
        const baseX = (0.2 * (3 - (i % 6))); // Base x-position
        const baseY = (i > 6 ? 0.8 : 0.4);   // Base y-position (first row or second row)

        // Apply the shared offset to x-coordinate
        inputTriangles[i].translation[0] = baseX + offset;
        let currTimestamp = Date.now();

        // if(currTimestamp % 4000 > 2000) 
        {
            inputTriangles[i].material.ambient = vec3.fromValues((Math.sin(currTimestamp*0.003)+1)/2, 0.4, 1-(Math.sin(currTimestamp*0.003)+1)/2);
        }

        var f = (index) => {
            let lastTimestamp = currTimestamp;
            currTimestamp = Date.now();
            let deltaTime = (currTimestamp - lastTimestamp)/1000;

            
    
            var velocity = 1.0;
    
            inputTriangles[index].translation[1] -= deltaTime * velocity;

            if(vec3.distance(inputTriangles[index].translation, inputTriangles[0].translation) < 0.075) {
                console.log("GAmeOver");
                gameOver();
                return;

                if(index == 16) {
                    lastMissileFired[2] = false;
                }
                return;
            }
            if(inputTriangles[index].translation[1] < -1.4) {
                
                return;
            }
    
            renderModels();
            requestAnimationFrame(() => f(index));
        }

        
        if(i == randShipDown[0] || i == randShipDown[1]){

            inputTriangles[i].translation[1] = baseY - enemyDropVelocity*(elapsedTime-enemyTimer[(i == randShipDown[0]) ? 0 : 1 ]); // Keep y-position fixed
            inputTriangles[i].translation[0] = baseX + offset + offset;
            // missile firing
            if(inputTriangles[i].translation[1] < 0.0 && lastMissileFired[(i == randShipDown[0]) ? 2 : 5] == false) {
                inputTriangles[(i == randShipDown[0]) ? 16 : 19].translation = vec3.clone(inputTriangles[i].translation);
                lastMissileFired[(i == randShipDown[0]) ? 2 : 5] = true;
                f((i == randShipDown[0]) ? 16 : 19);
                console.log("called f(16)");
                
            } else if(inputTriangles[i].translation[1] < 0.2  && lastMissileFired[(i == randShipDown[0]) ? 1 : 4] == false) {
                inputTriangles[(i == randShipDown[0]) ? 15 : 18].translation = vec3.clone(inputTriangles[i].translation);
                lastMissileFired[(i == randShipDown[0]) ? 1 : 4] = true;
                f((i == randShipDown[0]) ? 15 : 18);
                console.log("called f(15)");

            } else if (inputTriangles[i].translation[1] < 0.4  && lastMissileFired[(i == randShipDown[0]) ? 0 : 3] == false) {
                inputTriangles[(i == randShipDown[0]) ? 14 : 17].translation = vec3.clone(inputTriangles[i].translation);
                lastMissileFired[(i == randShipDown[0]) ? 0 : 3] = true;
                f((i == randShipDown[0]) ? 14 : 17);
                console.log("called f(14)");

            }
        }

        if(inputTriangles[i].isDead == true) {
            inputTriangles[i].translation[0] = 10;
        }
        
        var g = (index) => {
            let lastTimestamp = currTimestamp;
            currTimestamp = Date.now();
            let deltaTime = (currTimestamp - lastTimestamp)/1000;

            var velocity = 1.0;

            inputTriangles[index].translation[1] -= deltaTime * velocity;

            if(inputTriangles[index].translation[1] < (index > 6 ? 0.8 : 0.4)) {
                inputTriangles[index].translation[1] = (index > 6 ? 0.8 : 0.4);
                return;
            }
    
            renderModels();
            requestAnimationFrame(() => g(index));
        } 

        if(inputTriangles[i].translation[1] < -1.0) {
            inputTriangles[i].translation[0] = baseX + offset;
            inputTriangles[i].translation[1] = baseY + 0.5; //changed
            if(i == randShipDown[0])
            {
                g(i);
                randShipDown[0] = -1;
                enemyTimer[0] = elapsedTime;
                lastMissileFired[0] = false;
                lastMissileFired[1] = false;
                lastMissileFired[2] = false;
            }
            else {
                g(i);
                randShipDown[1] = -1;
                enemyTimer[1] = elapsedTime;
                lastMissileFired[3] = false;
                lastMissileFired[4] = false;
                lastMissileFired[5] = false;
            }
            if(randShipDown[0] == -1 && randShipDown[1] == -1)
                enemySent = false;
            
        }
        
        if(vec3.distance(inputTriangles[0].translation, inputTriangles[i].translation) < 0.1) {
            console.log("GAME OVER");
            gameOver();
        }
    }

    var areAllDead = true;
    for(let i = 1; i < 13; i++) {
        if(inputTriangles[i].isDead == false) {
            areAllDead = false;
            break;
        }
    }
    if(areAllDead) {
        gameWin();
    }

    renderModels(); // Redraw the models with updated positions

    

    requestAnimationFrame(animateEnemies); // Loop the animation
}



let missileActive = false; // Tracks if a missile is in the scene
let missilePosition = vec3.create(); // Missile's position
const missileSpeed = 2.0; // Speed of the missile (units per second)
let allowFire = 1;

function fireMissile() {

    if(!allowFire) {
        console.log("Can't fire yet");
        return;
    }
    allowFire = 0;

    inputTriangles[13].translation[0] = inputTriangles[0].translation[0];
    inputTriangles[13].translation[1] = inputTriangles[0].translation[1];
    inputTriangles[13].translation[2] = inputTriangles[0].translation[2];
    inputTriangles[13].scale = vec3.fromValues(0.1,0.7,0.1);
    var currTimestamp = Date.now();

    var f = () => {
        
        var lastTimestamp = currTimestamp;
        currTimestamp = Date.now();
        var deltaTime = (currTimestamp - lastTimestamp)/1000;

        var velocity = 1.0;

        inputTriangles[13].translation[1] += deltaTime * velocity;
        if(inputTriangles[13].translation[1] > 1.2) {
            // reset missile flag
            allowFire = 1;
            return;
        }

        for(let i = 1; i < 13; i++) {
            if(inputTriangles[i].isDead == false && vec3.distance(inputTriangles[i].translation, inputTriangles[13].translation) < 0.075) {
                inputTriangles[i].isDead = true;
                if(randShipDown[0]==i || randShipDown[1] == i) {
                    
                    
                    if(i == randShipDown[0])
                    {
                        randShipDown[0] = -1;
                        enemyTimer[0] = elapsedTime;
                    }
                    else {
                        randShipDown[1] = -1;
                        enemyTimer[1] = elapsedTime;
                    }
                    if(randShipDown[0] == -1 && randShipDown[1] == -1)
                        enemySent = false;
                }
                allowFire = 1;
                inputTriangles[13].translation[1] += 10;
            }
        }

        

        renderModels();
        requestAnimationFrame(f)
    } 

    f();
    

}

function gameOver() {
    document.getElementById("Game_Over_Window").style.display = "flex";
}

function gameWin() {
    document.getElementById("Game_Win_Window").style.display = "flex";
}

var isMakeItYourOwn = false;
var isFirstPerson = false;

function makeItYourOwn() {
    isMakeItYourOwn = true;
    // Eye = vec3.fromValues(inputTriangles[0].translation[0], inputTriangles[0].translation[1] + 0.05, inputTriangles[0].translation[2]-0.15)
    // Up = vec3.fromValues(0,0,-1);
    // Center = vec3.fromValues(inputTriangles[0].translation[0], inputTriangles[0].translation[1] + 0.1, inputTriangles[0].translation[2]-0.15);
    
    var imageCanvas = document.getElementById("myImageCanvas"); // create a 2d canvas
    var cw = imageCanvas.width, ch = imageCanvas.height; 
    imageContext = imageCanvas.getContext("2d"); 
    var bkgdImage = new Image(); 
    //bkgdImage.crossOrigin = "Anonymous";
    bkgdImage.src = "black.png";
    bkgdImage.onload = function(){
        var iw = bkgdImage.width, ih = bkgdImage.height;
        imageContext.drawImage(bkgdImage,0,0,iw,ih,0,0,cw,ch);   
   }

    for(let i = 0; i <= 19; i++) {
        inputTriangles[i].material.alpha = 1.0;
    }
}






/* MAIN -- HERE is where execution begins after window load */

function main() {
  
  setupWebGL(); // set up the webGL environment
  loadModels(); // load in the models from tri file
  loadTextures();
  setupShaders(); // setup the webGL shaders
  renderModels(); // draw the triangles using webGL
  animateEnemies();
//   moveShip();

//   addEventListener("keyup", (event) => {console.log(event)});
inputTriangles[0].translation[1] = -0.6;
for(let i = 13; i <= 19; i++)
    inputTriangles[i].translation[0] = 10; // miussile

// inputTriangles[1].yAxis = vec3.fromValues(0,-1,0);
// inputTriangles[1].translation[1] = 0.4;

// // inputTriangles[2] = inputTriangles[1];
// inputTriangles[2].translation[0]=-0.4
for(let i = 1; i < 13; i++)
{
    inputTriangles[i].translation[1] = 0.4;
    if(i>6) {inputTriangles[i].translation[1] = 0.8;}
    inputTriangles[i].translation[0] = (0.2 * (3-(i%6)));
}

    var currTimestamp = Date.now();

    var moveShip = () => {
        var dir = 0;
        if(keydownA) dir = 1;
        if(keydownD) dir = -1; 
        
        var lastTimestamp = currTimestamp;
        currTimestamp = Date.now();
        var deltaTime = (currTimestamp - lastTimestamp)/1000;

        var velocity = 0.4;

        inputTriangles[0].translation[0] += deltaTime * velocity * dir;

        // if(isMakeItYourOwn ) {
        //     Eye = vec3.fromValues(inputTriangles[0].translation[0], inputTriangles[0].translation[1] + 0.05, inputTriangles[0].translation[2]-0.15)
        //     Up = vec3.fromValues(0,0,-1);
        //     Center = vec3.fromValues(inputTriangles[0].translation[0], inputTriangles[0].translation[1] + 0.1, inputTriangles[0].translation[2]-0.15);
        // }

        renderModels();
        requestAnimationFrame(moveShip);

    }
    moveShip();




  onkeydown = (event) => {
    console.log(event);
    if(event.key == 'a') { keydownA = 1 };
    if(event.key == 'd') { keydownD = 1 };


    if(event.key == 'a') {
        // console.log(vec3.add(inputTriangles[0].translation, inputTriangles[0].translation, vec3.fromValues(0.05,0.0,0.0)));
        // if(isMakeItYourOwn ) {
        //     Eye = vec3.fromValues(inputTriangles[0].translation[0], inputTriangles[0].translation[1] + 0.05, inputTriangles[0].translation[2]-0.15)
        //     Up = vec3.fromValues(0,0,-1);
        //     Center = vec3.fromValues(inputTriangles[0].translation[0], inputTriangles[0].translation[1] + 0.1, inputTriangles[0].translation[2]-0.15);
        // }
        
    }
    else if(event.key == 'd') {
        // console.log(vec3.add(inputTriangles[0].translation, inputTriangles[0].translation, vec3.fromValues(-0.05,0.0,0.0)));
        // if(isMakeItYourOwn ) {
        //     Eye = vec3.fromValues(inputTriangles[0].translation[0], inputTriangles[0].translation[1] + 0.05, inputTriangles[0].translation[2]-0.15)
        //     Up = vec3.fromValues(0,0,-1);
        //     Center = vec3.fromValues(inputTriangles[0].translation[0], inputTriangles[0].translation[1] + 0.1, inputTriangles[0].translation[2]-0.15);
        // }

    }

    if(event.key == ' ') {
        fireMissile();
    }
    
    if(event.key == '!') {
        makeItYourOwn();
    }
};

    onkeyup = (event) => {
        console.log(event);
        if(event.key == 'a') { keydownA = 0 };
        if(event.key == 'd') { keydownD = 0 };
    }


  
} // end main

// make fov 0.5 for miyo
// move cam to given thiungioes
