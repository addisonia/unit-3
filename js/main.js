// Pseudo-global variables
var attrArray = ["POP_GROWTH_PCT_SINCE_2000"]; // List of attributes
var expressed = attrArray[0]; // Initial attribute

// Begin script when window loads
window.onload = setMap;

// Set up choropleth map
function setMap() {
  // Map frame dimensions
  var width = window.innerWidth * 0.5,
    height = 460;

  // Create new svg container for the map
  var map = d3
    .select("body")
    .append("svg")
    .attr("class", "map")
    .attr("width", width)
    .attr("height", height);

  // Create Albers equal area conic projection centered on Nevada
  var projection = d3
    .geoAlbers()
    .rotate([115,0,0])
    .center([-2, 38.5]) // Center the projection on Nevada
    .parallels([35, 43])
    .scale(3000) // Adjust the scale to zoom in on Nevada
    .translate([width / 2, height / 2]); // Center the map in the SVG container

  // Path generator using the Albers projection
  var path = d3.geoPath().projection(projection);

  // Use Promise.all to parallelize asynchronous data loading
  var promises = [
    d3.csv("data/Nevada_Counties_SIMPLIFIED.csv"),
    d3.json("data/Nevada_Counties_SIMPLIFIED.json") // Adjusted for .json
  ];
  Promise.all(promises).then(callback);

  function callback(data) {
    var csvData = data[0]; // CSV attribute data
    var nevadaTopojson = data[1]; // TopoJSON spatial data

    // Translate TopoJSON to GeoJSON
    var nevadaCounties = topojson.feature(
      nevadaTopojson,
      nevadaTopojson.objects.Nevada_Counties_SIMPLIFIED
    );

    // Join the CSV data to the GeoJSON features
    nevadaCounties.features.forEach(function (feature) {
      var countyName = feature.properties.NAME;
      var countyData = csvData.find(function (d) {
        return d.NAME === countyName;
      });

      if (countyData) {
        feature.properties = Object.assign({}, feature.properties, countyData);
      }
    });

    // Create the color scale using Natural Breaks
    var colorScale = makeColorScale(nevadaCounties.features);

    // Add enumeration units to the map
    setEnumerationUnits(nevadaCounties, map, path, colorScale);

    // Add coordinated visualization to the map
    setChart(csvData, colorScale);
  }

  // Define color scale function using Natural Breaks
  function makeColorScale(data) {
    var colorClasses = [
      "#f7fcf0",
      "#e0f3db",
      "#ccebc5",
      "#a8ddb5",
      "#7bccc4",
      "#4eb3d3",
      "#2b8cbe",
      "#0868ac",
      "#084081"
    ];

    // Create color scale generator
    var colorScale = d3.scaleThreshold()
      .range(colorClasses);

    // Build array of all values of the expressed attribute
    var domainArray = data.map(function (d) {
      return +d.properties[expressed];
    });

    // Cluster data using ckmeans clustering algorithm to create natural breaks
    var clusters = ss.ckmeans(domainArray, colorClasses.length);

    // Set domain array to cluster minimums
    domainArray = clusters.map(function (d) {
      return d3.min(d);
    });

    // Remove first value from domain array to create class breakpoints
    domainArray.shift();

    // Assign array of last 4 cluster minimums as domain
    colorScale.domain(domainArray);

    return colorScale;
  }

  // Function to set enumeration units and apply color scale
  function setEnumerationUnits(counties, map, path, colorScale) {
    var regions = map.selectAll(".county")
      .data(counties.features)
      .enter()
      .append("path")
      .attr("class", function (d) {
        return "county " + d.properties.NAME;
      })
      .attr("d", path)
      .style("fill", function (d) {
        var value = d.properties[expressed];
        if (value) {
          return colorScale(value);
        } else {
          return "#ccc"; // Assign a neutral color for missing values
        }
      });
  }

  // Create graticule generator
  var graticule = d3.geoGraticule().step([5, 5]);

  // Draw graticule background
  var gratBackground = map
    .append("path")
    .datum(graticule.outline()) // Bind graticule background
    .attr("class", "gratBackground") // Assign class for styling
    .attr("d", path); // Project graticule

  // Draw graticule lines
  var gratLines = map
    .selectAll(".gratLines") // Select graticule elements that will be created
    .data(graticule.lines()) // Bind graticule lines to each element to be created
    .enter() // Create an element for each datum
    .append("path") // Append each element to the svg as a path element
    .attr("class", "gratLines") // Assign class for styling
    .attr("d", path); // Project graticule lines
}

// Function to create coordinated bar chart
function setChart(csvData, colorScale) {
  // Chart frame dimensions
  var chartWidth = window.innerWidth * 0.45,
    chartHeight = 460;

  // Create a second svg element to hold the bar chart
  var chart = d3.select("body")
    .append("svg")
    .attr("width", chartWidth)
    .attr("height", chartHeight)
    .attr("class", "chart");

  // Create a rectangle for chart background fill
  var chartBackground = chart.append("rect")
    .attr("class", "chartBackground")
    .attr("width", chartWidth)
    .attr("height", chartHeight);

  // Create a scale to size bars proportionally to frame
  var yScale = d3.scaleLinear()
    .range([0, chartHeight])
    .domain([0, d3.max(csvData, function (d) { return parseFloat(d[expressed]); })]);

  // Set bars for each county
  var bars = chart.selectAll(".bar")
    .data(csvData)
    .enter()
    .append("rect")
    .sort(function (a, b) { return a[expressed] - b[expressed]; })
    .attr("class", function (d) { return "bar " + d.NAME; })
    .attr("width", chartWidth / csvData.length - 1)
    .attr("x", function (d, i) { return i * (chartWidth / csvData.length); })
    .attr("height", function (d) { return yScale(parseFloat(d[expressed])); })
    .attr("y", function (d) { return chartHeight - yScale(parseFloat(d[expressed])); })
    .style("fill", function (d) { return colorScale(d[expressed]); });

  // Annotate bars with attribute value text
  var numbers = chart.selectAll(".numbers")
    .data(csvData)
    .enter()
    .append("text")
    .sort(function (a, b) { return a[expressed] - b[expressed]; })
    .attr("class", function (d) { return "numbers " + d.NAME; })
    .attr("text-anchor", "middle")
    .attr("x", function (d, i) {
      var fraction = chartWidth / csvData.length;
      return i * fraction + (fraction - 1) / 2;
    })
    .attr("y", function (d) { return chartHeight - yScale(parseFloat(d[expressed])) + 15; })
    .text(function (d) { return d[expressed]; });

  // Create a text element for the chart title
  var chartTitle = chart.append("text")
    .attr("x", chartWidth / 2) // Position the title at the center of the chart width
    .attr("y", 40)
    .attr("class", "chartTitle")
    .attr("text-anchor", "middle") // Center the title text horizontally
    .text("Population Growth (%) since 2000 in Nevada Counties");

  // Wrap the chart title text if it overlaps with the bars
  var words = chartTitle.text().split(/\s+/).reverse(),
    word,
    line = [],
    lineNumber = 0,
    lineHeight = 1.1, // ems
    y = chartTitle.attr("y"),
    dy = 0,
    tspan = chartTitle.text(null).append("tspan").attr("x", chartWidth / 2).attr("y", y).attr("dy", dy + "em");

  while (word = words.pop()) {
    line.push(word);
    tspan.text(line.join(" "));
    if (tspan.node().getComputedTextLength() > chartWidth - 20) { // Adjust the condition
      line.pop();
      tspan.text(line.join(" "));
      line = [word];
      tspan = chartTitle.append("tspan").attr("x", chartWidth / 2).attr("y", y).attr("dy", ++lineNumber * lineHeight + dy + "em").text(word);
    }
  }
}