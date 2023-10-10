var loadingText = document.getElementById('loadingText');
var errorText = document.getElementById('errorText');
var username = document.getElementById('username');
var password = document.getElementById('password');
var downloadDiv = document.getElementById('downloads');

function generateCSVlink(filename, data){
  var fileOut = "Time, Speed (KMPH), Speed (MPH), Acceleration, Longitude, Latitude, SatelliteNum, Accuracy, Heading, Altitude\n";
  var rawDataArr = data?.dataArr;
  for (let item of rawDataArr){
    // acceleration, accuracy, altitude, heading, latitude, longitude, satelliteNum, speed, time
    fileOut += `${item?.time},${item?.speed},${Math.floor((item?.speed/1.609344) * 1000) / 1000},${item?.acceleration},${item?.longitude},${item?.latitude},${item?.satelliteNum},${item?.accuracy},${item?.heading},${item?.altitude}\n`
  }

  var element = document.createElement('a');
  element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(fileOut));
  element.setAttribute('download', filename);
  element.innerText = filename;
  element.style.paddingRight = "10px";

  downloadDiv.appendChild(element);
}

async function getData(){
  loadingText.hidden = false;
  errorText.hidden = true;

  var logindata = `userType=4&platform=5&platformId=${username.value}&password=${password.value}`;

  while (downloadDiv.firstChild){
    downloadDiv.removeChild(downloadDiv.lastChild);
  }

  try{
    var response = await fetch("http://app.godragy.com/index.php/account/login", {
      method: "POST",
      body: logindata,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': logindata.length
      }
    });

    var data = await response.json();

    if (!data.err){
      var userId = data?.data?.userInfo?.userId;
      var sessionId = data?.data?.sessionId;

      if (!userId || !sessionId){
        throw new Error("Invalid login return data, userId or sessionId doesn't exist.");
      }

      var profileResponse = await fetch(`http://app.godragy.com/dragy/otherUserInfo/getOtherUserForumList?otherUserId=${userId}`, {
        method: "GET"
      });

      var profileData = await profileResponse.json();

      var carDataEntryIds = [];

      if (profileData?.data?.data){
        var profiledataarr = profileData?.data?.data;
        for (let profileDataEntry of profiledataarr){
          if (profileDataEntry?.carBankingList){
            var carEntryData = JSON.parse(profileDataEntry?.carBankingList);
            if (carEntryData[0]?.id){
              carDataEntryIds.push(carEntryData[0]?.id);
            }
          }
        }
      }else {
        console.log(profileData);
        throw new Error("Get profile data failed, no data returned. Make sure you have a published run!");
      }

      if (carDataEntryIds.length >= 1){
        var errMsg = "";

        for (let runId of carDataEntryIds){
          try{
            var entryData = `id=${runId}`;

            var entryResponse = await fetch(`http://app.godragy.com/index.php/u_user/get_CarResults?sid=${sessionId}`, {
              method: "POST",
              body: entryData,
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': entryData.length
              }
            });

            var entryData = await entryResponse.json();

            if (!entryData.err){
              var result = entryData?.data?.carResults;
              var graphData = JSON.parse(result?.graph_data) || {};
              var dataInfo = JSON.parse(graphData?.dataInfo) || {};

              generateCSVlink(`dragy-${runId}.csv`, dataInfo);
            }else {
              errMsg += `Error [${entryData.err}]: ${entryData.errMsg}. `
            }
          }catch(e){
            errMsg += `Error fetching data for run ${runId}. `;
          }
        }

        if (errMsg){
          throw new Error(`Error fetching run data: ${errMsg}`);
        }
      }else {
        throw new Error("No run ids found. Make sure you have published runs on your account.");
      }
    }else {
      loadingText.hidden = true;
      errorText.innerHTML = `Error [${data.err}]: ${data.errMsg}`;
      errorText.hidden = false;
    }

    loadingText.hidden = true;
  }catch(e){
    loadingText.hidden = true;
    errorText.innerHTML = `Error Occured. Make sure login credentials are correct. ${e.message}`;
    errorText.hidden = false;
    console.error(e);
  }
}