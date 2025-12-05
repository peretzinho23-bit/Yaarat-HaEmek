// טעינת סקריפט הנגישות דינמית
(function () {
  const script = document.createElement("script");
  script.src = "https://cdn.jsdelivr.net/gh/nagishli/nagishli/dist/nagishli.min.js";
  script.onload = () => {
    nagishli.init({
      position: "right",
      color: "#38bdf8",
      iconSize: "large",
      language: "he",
    });
  };
  document.body.appendChild(script);
})();
