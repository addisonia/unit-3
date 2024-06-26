// Pseudo-global variables
var attrArray = ["POP_GROWTH_PCT_SINCE_2000", "MEDIAN_INCOME", "MEAN_INCOME", "INCOME_100K_OR_MORE_PCT", "UNEMPLOYMENT_RATE", "POVERTY_RATE", "EDUCATION_LEVEL", "AGRICULTURE_FORESTRY_FISHING_HUNTING_MINING_PCT"];
var expressed = attrArray[0]; // Initial attribute
var csvData, map, colorScale, yScale; // Define globally for access in multiple functions

// Begin script when window loads
window.onload = function() {
  setMap();
  createDropdown(attrArray);
};

window.onresize = function(){
  setMap();
}

// Set up choropleth map

function setMap() {
  // Remove the existing SVG if it exists
  d3.select(".map").remove();
  d3.select(".chart").remove();

  // Define a minimum height threshold
  var minHeightThreshold = 400;  // or whatever minimum height you prefer

  // Calculate width and height based on current window size
  var width = window.innerWidth <= 800 ? window.innerWidth : window.innerWidth * 0.5;
  var height = window.innerWidth <= 800 ? 350 : window.innerHeight * 0.75;

  // Ensure the height does not go below the minimum threshold
  if (window.innerWidth > 800 && height < minHeightThreshold) {
    height = minHeightThreshold;
  }

  map = d3.select("body")
      .append("svg")
      .attr("class", "map")
      .attr("width", width)
      .attr("height", height);

  // Check for window width and adjust projection settings
  var scale, center;
  if (window.innerWidth <= 800) {
    scale = 2500; // smaller scale for less zoom
    center = [-2, 38.5]; // adjust center to show more area
  } else {
    scale = 3000; // original scale
    center = [-2, 38.5]; // original center
  }

  var projection = d3.geoAlbers()
      .rotate([115, 0, 0])
      .center(center)
      .parallels([35, 43])
      .scale(scale)
      .translate([width / 2, height / 2]);

  var path = d3.geoPath().projection(projection);
  var promises = [
      d3.csv("data/Nevada_Counties_SIMPLIFIED.csv"),
      d3.json("data/Nevada_Counties_SIMPLIFIED.json")
  ];

  Promise.all(promises).then(function(data) {
      csvData = data[0];
      var nevadaTopojson = data[1];
      var nevadaCounties = topojson.feature(nevadaTopojson, nevadaTopojson.objects.Nevada_Counties_SIMPLIFIED);
      nevadaCounties.features.forEach(function(feature) {
          var countyData = csvData.find(function(d) { return d.NAME === feature.properties.NAME; });
          if (countyData) {
              feature.properties = {...feature.properties, ...countyData};
          }
      });
      colorScale = makeColorScale(nevadaCounties.features);
      setEnumerationUnits(nevadaCounties, map, path, colorScale);
      setChart(csvData, colorScale);
  });

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

    regions.on("mouseover", function(event, d) {
        highlight(d.properties);
    })
    .on("mouseout", function(event, d) {
        dehighlight(d.properties);
    })
    .on("mousemove", moveLabel);

    regions.append("desc")
       .text(function(d) {
           return JSON.stringify({stroke: "#000", "stroke-width": "0.5px"});
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



    let resizeTimeout;
    window.onresize = function() {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(function() {
        setMap();
        setChart(csvData, colorScale); // Ensure you call setChart with proper arguments
      }, 100);
    };

}

// Define color scale function using Natural Breaks
function makeColorScale(data) {
  var domainArray = data.map(function(d) {
      return +d.properties[expressed];
  });
  var clusters = ss.ckmeans(domainArray, 9);
  domainArray = clusters.map(function(d) { return d3.min(d); });
  domainArray.shift(); // Adjust to remove the first breakpoint if necessary
  return d3.scaleThreshold().domain(domainArray).range([ 
      "#FFFFFF",
      "#e7f5e4",
      "#ccebc5", 
      "#a8ddb5", 
      "#7bccc4", 
      "#4eb3d3", 
      "#2b8cbe", 
      "#0868ac", 
      "#084081", 
      "#052c5c",
      '#040624'
  ]);
}






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


// Function to create coordinated bar chart
function setChart(csvData, colorScale) {
  // Remove the previous chart before drawing a new one
  d3.select(".chart").remove();

  var chartWidth = window.innerWidth <= 800 ? window.innerWidth * 0.95 : window.innerWidth * 0.45,
      chartHeight = window.innerWidth <= 800 ? 400 : 600, // Reduce chart height by 20% for small screens
      margin = {top: 30, right: 30, bottom: 30, left: 40}, // Adjust margins for better spacing
      chartInnerWidth = chartWidth - margin.left - margin.right,
      chartInnerHeight = chartHeight - margin.top - margin.bottom;

  var chart = d3.select("body").append("svg")
      .attr("width", chartWidth)
      .attr("height", chartHeight)
      .attr("class", "chart")
      .append("g")
      .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

var maxDataValue = d3.max(csvData, function(d) { return parseFloat(d[expressed]); });
yScale = d3.scaleLinear()
  .range([chartInnerHeight, 0])
  .domain([0, maxDataValue / 0.80]);  // Adjust the domain so the top 20% of the chart is empty

var yAxis = d3.axisLeft(yScale);
chart.append("g")
  .attr("class", "axis y-axis")
  .call(yAxis);

var chartBackground = chart.append("rect")
  .attr("class", "chartBackground")
  .attr("width", chartInnerWidth)
  .attr("height", chartInnerHeight)
  .attr("fill", "white");

var bars = chart.selectAll(".bar")
  .data(csvData.sort(function(a, b) { return b[expressed] - a[expressed]; }), d => d.NAME)
  .enter()
  .append("rect")
  .attr("class", function(d) { return "bar " + d.NAME.replace(/ /g, '_'); })
  .attr("x", function(d, i) { return i * (chartInnerWidth / csvData.length); })
  .attr("width", chartInnerWidth / csvData.length - 1)
  .attr("y", d => yScale(parseFloat(d[expressed])))
  .attr("height", d => chartInnerHeight - yScale(parseFloat(d[expressed])))
  .style("fill", d => colorScale(d[expressed]));

bars.on("mouseover", function(event, d) {
    highlight(d);
})
.on("mouseout", function(event, d) {
    dehighlight(d);
})
.on("mousemove", moveLabel);

bars.append("desc")
  .text('{"stroke": "none", "stroke-width": "0px"}');

    // Adjusted chart title to always be centered within the chart box
    var chartTitle = chart.append("text")
      .attr("x", chartWidth / 2) // Center the title by setting x to half of chartWidth
      .attr("y", 40)
      .attr("class", "chartTitle")
      .style("text-anchor", "middle") // Ensure the title is centered on the x position
      .text("Population Growth (%)");

    chartTitle.append("tspan")
      .attr("x", chartWidth / 2) // Also center the second line of the title
      .attr("y", 65)
      .style("text-anchor", "middle") // Center the text for the tspan as well
      .text("since 2000 in Nevada Counties");
}




function updateChart(csvData, colorScale) {

  var chartWidth = window.innerWidth <= 800 ? window.innerWidth * 0.95 : window.innerWidth * 0.45,
      chartHeight = window.innerWidth <= 800 ? 400 : 600, // Reduce chart height by 20% for small screens
      margin = {top: 30, right: 30, bottom: 30, left: 40}, // Adjust margins for better spacing
      chartInnerWidth = chartWidth - margin.left - margin.right,
      chartInnerHeight = chartHeight - margin.top - margin.bottom;

  // Check if the chart group exists, if not, create it
  var chart = d3.select(".chart");
  if (chart.empty()) {
    chart = d3.select("body").append("svg")
      .attr("width", chartWidth)
      .attr("height", chartInnerHeight + margin.top + margin.bottom)
      .attr("class", "chart")
      .append("g")
      .attr("transform", "translate(" + margin.left + "," + margin.top + ")");
  } else {
    chart = chart.select("g");
  }

  maxDataValue = d3.max(csvData, function(d) { return parseFloat(d[expressed]); });

  // Update the scale domain to maintain the 30% empty space at the top
  yScale.domain([0, maxDataValue / 0.8]);

  chart.select(".y-axis").transition().duration(500).call(d3.axisLeft(yScale));

  var bars = chart.selectAll(".bar")
      .data(csvData.sort(function(a, b) { return b[expressed] - a[expressed]; }), d => d.NAME);

  bars.enter()
      .append("rect")
      .merge(bars)
      .transition()
      .duration(500)
      .attr("x", (d, i) => i * (chartInnerWidth / csvData.length))
      .attr("width", chartInnerWidth / csvData.length - 1)
      .attr("y", d => yScale(parseFloat(d[expressed])))
      .attr("height", d => chartInnerHeight - yScale(parseFloat(d[expressed])))
      .style("fill", d => colorScale(d[expressed]));

  bars.exit().remove();
}




function updateMap(colorScale) {
  d3.selectAll(".county")
    .transition()
    .duration(500)
    .style("fill", function(d) {
      var value = d.properties[expressed];
      return value ? colorScale(value) : "#ccc";
    });
}




// Add a function to create the dropdown for attribute selection
function createDropdown(attrArray) {
  var readableNames = {
      "POP_GROWTH_PCT_SINCE_2000": "Population Growth (%) Since 2000",
      "MEDIAN_INCOME": "Median Household Income",
      "MEAN_INCOME": "Mean Household Income",
      "INCOME_100K_OR_MORE_PCT": "Income of 100k or more (%)",
      "AGRICULTURE_FORESTRY_FISHING_HUNTING_MINING_PCT": "(%) of Workers in Primary Industries",
      "UNEMPLOYMENT_RATE": "Unemployment Rate",
      "POVERTY_RATE": "Poverty Rate",
      "EDUCATION_LEVEL": "(%) with Graduate Degrees"
  };

  var dropdown = d3.select("body").append("select")
      .attr("class", "dropdown")
      .on("change", function() {
          changeAttribute(this.value);
      });

  dropdown.selectAll("option")
      .data(attrArray)
      .enter()
      .append("option")
      .attr("value", d => d)
      .text(d => readableNames[d]);  // Use readable names for options
}



// Call createDropdown in your window.onload function
window.onload = function() {
  setMap();
  createDropdown(["POP_GROWTH_PCT_SINCE_2000", "MEAN_INCOME", "MEDIAN_INCOME", "INCOME_100K_OR_MORE_PCT", "AGRICULTURE_FORESTRY_FISHING_HUNTING_MINING_PCT", "UNEMPLOYMENT_RATE", "POVERTY_RATE", "EDUCATION_LEVEL"]); // Update this list based on your dataset
};


function changeAttribute(attribute) {
  expressed = attribute;  // Update the expressed attribute globally
  colorScale = makeColorScale(map.selectAll(".county").data());  // Recalculate color scale based on new attribute

  d3.selectAll(".county")
      .transition()
      .duration(500)
      .style("fill", d => {
          var value = d.properties[expressed];
          return value ? colorScale(value) : "#ccc";
      });

  updateChartTitle();  // Update chart titles and subtitles
  updateChart(csvData, colorScale);  // Redraw chart with new attribute data
}

function updateChartTitle() {
  var titles = {
      "POP_GROWTH_PCT_SINCE_2000": "Population Growth (%) Since 2000",
      "MEDIAN_INCOME": "Median Household Income",
      "MEAN_INCOME": "Mean Household Income",
      "INCOME_100K_OR_MORE_PCT": "Income of 100k or more (%)",
      "AGRICULTURE_FORESTRY_FISHING_HUNTING_MINING_PCT": "Agriculture, Forestry, Hunting, and Mining",
      "UNEMPLOYMENT_RATE": "Unemployment Rate",
      "POVERTY_RATE": "Poverty Rate",
      "EDUCATION_LEVEL": "(%) with Graduate Degrees"
  };

  d3.select(".chartTitle").text(titles[expressed]);
  d3.select(".chartTitle + tspan").text("in Nevada Counties");  // Static text as the subtitle
}



function highlight(props) {
  d3.selectAll("." + props.NAME.replace(/ /g, '_'))
      .style("stroke", "red")
      .style("stroke-width", "2px");

  // Set label for highlighted element
  setLabel(props);
}


function dehighlight(props) {
  var selector = "." + props.NAME.replace(/ /g, '_');
  var selected = d3.selectAll(selector);
  var originalStyle = JSON.parse(selected.select("desc").text());
  selected.style("stroke", originalStyle.stroke)
         .style("stroke-width", originalStyle["stroke-width"]);

  // Remove dynamic label
  d3.selectAll(".infolabel").remove();
}


//function to create dynamic label
function setLabel(props) {
  var labelValue = props[expressed];
  
  // Append "%" for rates specifically
  if (expressed === "POP_GROWTH_PCT_SINCE_2000" || expressed === "UNEMPLOYMENT_RATE" || expressed === "INCOME_100K_OR_MORE_PCT" || expressed === "EDUCATION_LEVEL" || expressed === "POVERTY_RATE" || expressed === "AGRICULTURE_FORESTRY_FISHING_HUNTING_MINING_PCT") {
      labelValue += "%";  // Ensure the percentage sign is appended correctly
  } else if (expressed === "MEDIAN_INCOME" || expressed === "MEAN_INCOME") {
    labelValue = "$" + parseFloat(labelValue).toLocaleString();  // Prepend "$" and format with commas
  }

  // Label content, now only showing the value
  var labelAttribute = "<h1>" + labelValue + "</h1>";

  // Update or create the info label div
  var infolabel = d3.select(".infolabel");
  if (infolabel.empty()) {
      infolabel = d3.select("body").append("div")
          .attr("class", "infolabel")
          .attr("id", props.adm1_code + "_label");
  }
  infolabel.html(labelAttribute);

  // Optionally, append a div for the county name if needed
  infolabel.append("div")
      .attr("class", "labelname")
      .html(props.NAME);
}



//function to move info label with mouse
function moveLabel(){
  //use coordinates of mousemove event to set label coordinates
  var x = event.clientX + 10,
      y = event.clientY - 75;

  d3.select(".infolabel")
      .style("left", x + "px")
      .style("top", y + "px");
};



// Toggle info popup visibility on button click
document.addEventListener('DOMContentLoaded', function() {
  const infoButton = document.querySelector('.info-button');
  const infoPopup = document.querySelector('.info-popup');

  // Toggle popup display on info button click
  infoButton.addEventListener('click', function(event) {
    // Prevent the document click listener from firing
    event.stopPropagation();
    // Toggle the display
    infoPopup.style.display = infoPopup.style.display === 'block' ? 'none' : 'block';
    positionPopup(infoPopup, this);
  });

  // Function to position the popup right below the button
  function positionPopup(popup, button) {
    const buttonRect = button.getBoundingClientRect();
    popup.style.top = (buttonRect.bottom + window.scrollY) + 'px'; // Position below the button
    
    // Calculate left position to slightly shift the popup to the left of the center of the button
    const popupOffset = popup.offsetWidth - buttonRect.width; // Find the difference in width
    let leftPos = buttonRect.left - popupOffset + 10; // Shift popup to the left by reducing its left position; adjust the value to fit your needs
    
    // Ensure popup does not go off the left side of the screen
    leftPos = Math.max(leftPos, 5); // Prevent cutoff at the screen edge
    popup.style.left = leftPos + 'px';
  }
  
  
  

  // Hide the popup when clicking outside of it
  document.addEventListener('click', function() {
    infoPopup.style.display = 'none';
  });
});
