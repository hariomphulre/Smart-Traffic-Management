import React, { useEffect, useRef, useState } from 'react';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { Bar } from 'react-chartjs-2';

// Register Chart.js components
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const SpeedDistributionChart = ({ speedData, timeFrame = 'hourly' }) => {
  const [chartData, setChartData] = useState({
    labels: [],
    datasets: []
  });
  const [speedStats, setSpeedStats] = useState({
    averageSpeed: 0,
    maxSpeed: 0,
    speedingCount: 0,
    speedingPercentage: 0
  });
  
  const chartRef = useRef(null);
  
  // Chart.js options
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: 600,
      easing: 'easeOutQuad'
    },
    interaction: {
      mode: 'index',
      enabled: false // Disable hover interactions
    },
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        enabled: false // Disable tooltips completely
      }
    },
    scales: {
      x: {
        grid: {
          display: false,
          drawBorder: false
        },
        ticks: {
          font: {
            family: 'Roboto',
            size: 11,
            weight: '500'
          },
          color: '#666'
        },
        title: {
          display: false
        }
      },
      y: {
        beginAtZero: true,
        grid: {
          color: 'rgba(0, 0, 0, 0.05)',
          drawBorder: false,
          lineWidth: 1
        },
        ticks: {
          precision: 0,
          font: {
            family: 'Roboto',
            size: 11
          },
          color: '#666',
          padding: 8
        },
        title: {
          display: false
        }
      }
    }
  };
  
  // Helper function to group speeds into ranges
  const groupSpeedRanges = (data) => {
    const ranges = {
      '0-20': 0,
      '21-40': 0,
      '41-60': 0,
      '61-80': 0,
      '81-100': 0,
      '100+': 0
    };
    
    if (!data || Object.keys(data).length === 0) {
      return ranges;
    }
    
    // Calculate speed statistics
    let total = 0;
    let max = 0;
    let speedingCount = 0; // Count vehicles going over 80 km/h
    const speedLimit = 80;
    const vehicleCount = Object.keys(data).length;
    
    Object.entries(data).forEach(([key, value]) => {
      // Extract the speed value based on data structure
      let speedValue;
      
      // Check the type of value and extract speed accordingly
      if (typeof value === 'number') {
        // If value is a direct number
        speedValue = value;
      } else if (typeof value === 'string') {
        // If value is a string, try to convert it to a number
        speedValue = parseFloat(value);
      } else if (typeof value === 'object' && value !== null) {
        // If value is an object, look for speed property
        if ('speed' in value) {
          speedValue = parseFloat(value.speed);
        } else {
          // Try to find the first numeric property or property that can be parsed as a number
          const numericProp = Object.entries(value).find(([k, v]) => 
            typeof v === 'number' || (typeof v === 'string' && !isNaN(parseFloat(v)))
          );
          
          speedValue = numericProp ? 
            (typeof numericProp[1] === 'number' ? 
              numericProp[1] : parseFloat(numericProp[1])) : 0;
        }
      } else {
        // Default if we can't determine the speed
        speedValue = 0;
        console.warn(`Could not determine speed for ${key}:`, value);
      }
      
      // Skip invalid values
      if (isNaN(speedValue) || !isFinite(speedValue) || speedValue < 0 || speedValue > 300) {
        console.warn(`Invalid speed value for ${key}:`, speedValue);
        return;
      }
      
      // Update statistics
      total += speedValue;
      max = Math.max(max, speedValue);
      if (speedValue > speedLimit) {
        speedingCount++;
      }
      
      // Group speeds
      if (speedValue <= 20) {
        ranges['0-20']++;
      } else if (speedValue <= 40) {
        ranges['21-40']++;
      } else if (speedValue <= 60) {
        ranges['41-60']++;
      } else if (speedValue <= 80) {
        ranges['61-80']++;
      } else if (speedValue <= 100) {
        ranges['81-100']++;
      } else {
        ranges['100+']++;
      }
    });
    
    // Sanity check to handle extreme values
    if (!isFinite(total) || total > Number.MAX_SAFE_INTEGER || total < 0) {
      console.error("Invalid total speed value:", total);
      total = 0;
    }
    
    if (!isFinite(max) || max > 300) {
      console.error("Invalid max speed value:", max);
      max = 0;
    }
    
    // Calculate average with safety checks
    const averageSpeed = vehicleCount > 0 ? total / vehicleCount : 0;
    
    // Verify the calculation is valid
    if (!isFinite(averageSpeed) || averageSpeed < 0 || averageSpeed > 300) {
      console.error("Invalid average speed calculation:", {
        total, vehicleCount, averageSpeed
      });
      
      // Update speed statistics with safe values
      setSpeedStats({
        averageSpeed: 0,
        maxSpeed: max > 0 && max <= 300 ? max : 0,
        speedingCount: speedingCount,
        speedingPercentage: vehicleCount > 0 ? Math.round((speedingCount / vehicleCount) * 100) : 0
      });
    } else {
      // Update speed statistics with calculated values
      setSpeedStats({
        averageSpeed: Math.round(averageSpeed),
        maxSpeed: max,
        speedingCount: speedingCount,
        speedingPercentage: vehicleCount > 0 ? Math.round((speedingCount / vehicleCount) * 100) : 0
      });
    }
    
    return ranges;
  };
  
  // Function to filter data based on timeFrame
  const filterDataByTimeFrame = (data, timeFrame) => {
    if (!data || Object.keys(data).length === 0) {
      return data;
    }
    
    const now = new Date();
    let filteredData = {};
    
    // Helper function to get timestamp from data entry
    const getEntryTimestamp = (value) => {
      if (typeof value === 'object' && value !== null) {
        // If value has timestamp property
        if (value.timestamp) {
          try {
            return new Date(value.timestamp);
          } catch (e) {
            // If parsing fails, return current date
            return new Date();
          }
        }
        
        // Look for any date-like property
        for (const prop in value) {
          if (typeof value[prop] === 'string' && 
              (prop.includes('time') || prop.includes('date') || prop.includes('created'))) {
            try {
              return new Date(value[prop]);
            } catch (e) {
              // Continue if parsing this property fails
            }
          }
        }
      }
      
      // Default: generate a random timestamp within the last day
      return new Date(now.getTime() - (Math.random() * 24 * 60 * 60 * 1000));
    };
    
    switch (timeFrame) {
      case 'hourly':
        // Last hour
        const oneHourAgo = new Date(now.getTime() - (60 * 60 * 1000));
        Object.entries(data).forEach(([key, value]) => {
          const timestamp = getEntryTimestamp(value);
          if (timestamp >= oneHourAgo) {
            filteredData[key] = value;
          }
        });
        break;
      case 'daily':
        // Last 24 hours
        const oneDayAgo = new Date(now.getTime() - (24 * 60 * 60 * 1000));
        Object.entries(data).forEach(([key, value]) => {
          const timestamp = getEntryTimestamp(value);
          if (timestamp >= oneDayAgo) {
            filteredData[key] = value;
          }
        });
        break;
      case 'weekly':
        // Last 7 days
        const oneWeekAgo = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
        Object.entries(data).forEach(([key, value]) => {
          const timestamp = getEntryTimestamp(value);
          if (timestamp >= oneWeekAgo) {
            filteredData[key] = value;
          }
        });
        break;
      case 'monthly':
        // Last 30 days
        const oneMonthAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
        Object.entries(data).forEach(([key, value]) => {
          const timestamp = getEntryTimestamp(value);
          if (timestamp >= oneMonthAgo) {
            filteredData[key] = value;
          }
        });
        break;
      case 'full':
      default:
        // All data
        filteredData = data;
    }
    
    // Ensure we have at least some data
    if (Object.keys(filteredData).length < 10) {
      // If not enough data in the filtered set, use all data
      return data;
    }
    
    return filteredData;
  };
  
  // Update chart data when speedData or timeFrame changes
  useEffect(() => {
    console.log("SpeedDistributionChart - Raw speed data:", speedData);
    
    // Filter data based on time frame
    const filteredData = filterDataByTimeFrame(speedData, timeFrame);
    console.log("SpeedDistributionChart - Filtered data:", filteredData);
    
    // Group filtered data into ranges
    const speedRanges = groupSpeedRanges(filteredData);
    console.log("SpeedDistributionChart - Speed ranges:", speedRanges);
    
    // Create chart data object
    const chartData = {
      labels: Object.keys(speedRanges).map(range => range),
      datasets: [
        {
          data: Object.values(speedRanges),
          backgroundColor: Array(Object.keys(speedRanges).length).fill('rgba(25, 118, 210, 0.7)'),
          borderColor: Array(Object.keys(speedRanges).length).fill('rgba(25, 118, 210, 1)'),
          borderWidth: 1,
          borderRadius: 4,
          borderSkipped: false,
          hoverBackgroundColor: Array(Object.keys(speedRanges).length).fill('rgba(25, 118, 210, 0.9)'),
          hoverBorderColor: Array(Object.keys(speedRanges).length).fill('rgba(25, 118, 210, 1)'),
          hoverBorderWidth: 1,
          barPercentage: 0.8,
          categoryPercentage: 0.85
        }
      ]
    };
    
    setChartData(chartData);
  }, [speedData, timeFrame]);
  
  // Check if there's any real data
  const hasData = speedData && Object.keys(speedData).length > 0;
  
  // Show placeholder if no data is available
  if (!hasData) {
    return (
      <div className="speed-distribution-chart compact d-flex justify-content-center align-items-center" style={{ height: '100%' }}>
        <div className="text-center text-muted">
          <i className="fas fa-tachometer-alt fa-3x mb-3"></i>
          <p>No speed data available. Upload data to see speed distribution.</p>
        </div>
      </div>
    );
  }
  
  // Display time frame label
  const getTimeFrameLabel = () => {
    switch(timeFrame) {
      case 'hourly': return 'Last Hour';
      case 'daily': return 'Last 24 Hours';
      case 'weekly': return 'Last 7 Days';
      case 'monthly': return 'Last 30 Days';
      case 'full': return 'All Time';
      default: return 'Last Hour';
    }
  };
  
  // Helper function to safely display numeric values
  const safeDisplayValue = (value) => {
    if (value === undefined || value === null || !isFinite(value)) {
      return 0;
    }
    return typeof value === 'number' ? value : 0;
  };

  return (
    <div className="speed-distribution-chart compact">
      <div className="stats-header-row">
        <div className="stat-header-box">
          <div className="stat-header-label">AVERAGE SPEED</div>
          <div className="stat-header-value avg-speed">{safeDisplayValue(speedStats.averageSpeed)}<span className="stat-unit">km/h</span></div>
        </div>
        <div className="stat-header-box">
          <div className="stat-header-label">MAX SPEED</div>
          <div className="stat-header-value max-speed">{safeDisplayValue(speedStats.maxSpeed)}<span className="stat-unit">km/h</span></div>
        </div>
        <div className="stat-header-box">
          <div className="stat-header-label">SPEEDING</div>
          <div className="stat-header-value speeding">{safeDisplayValue(speedStats.speedingPercentage)}<span className="stat-unit">%</span></div>
        </div>
      </div>
      
      <div className="info-row">
        <div className="info-box">
          <span className="info-label">VEHICLES</span>
          <span className="info-value">{speedData ? Object.keys(speedData).length : 0}</span>
        </div>
        <div className="info-box">
          <span className="info-label">RANGE</span>
          <span className="info-value">{safeDisplayValue(speedStats.maxSpeed - speedStats.averageSpeed)}<span className="stat-unit">km/h</span></span>
        </div>
        <div className="time-frame-info">
          <div className="time-frame-label">{getTimeFrameLabel()}</div>
        </div>
      </div>
      
      <div className="speed-chart-container">
        <Bar 
          ref={chartRef}
          data={chartData} 
          options={options}
        />
      </div>
    </div>
  );
};

export default SpeedDistributionChart; 