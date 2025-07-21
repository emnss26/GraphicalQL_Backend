const axios = require("axios");

const GetProjectReviews = async (token, projectId) => {
  const url = `https://developer.api.autodesk.com/construction/reviews/v1/projects/${projectId}/reviews`;

  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  try {
    const response = await axios.get(url, { headers });
    const projectReviews = response.data.results;
    
<<<<<<< HEAD
    console.log("Project reviews data:", projectReviews);
=======
    //console.log("Project reviews data:", projectReviews);
>>>>>>> 72bc097a467174a06524857e65f251e7d53ef5ac

    return projectReviews
    
  } catch (error) {
    console.error(
      "Error fetching project revisions:",
      error.response?.data || error.message
    );
    throw error;
  } 
};

module.exports = {
  GetProjectReviews,
};