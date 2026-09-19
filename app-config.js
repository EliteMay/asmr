// ASMRTube application metadata — single source of truth.
(function(){
  'use strict';

  const config=Object.freeze({
    appVersion:'3.0.2',
    build:'20260919-1',
    schemaVersion:1,
    guideVersion:'1.22.0',
    profiles:Object.freeze(['STATIC','DATA','MEDIA','TOOL'])
  });

  window.ASMRTUBE_CONFIG=config;

  function applyVersion(){
    document.documentElement.dataset.appVersion=config.appVersion;
    document.documentElement.dataset.build=config.build;
    document.title=`ASMRTube v${config.appVersion}`;
    const badge=document.querySelector('.sidebar-version strong');
    if(badge)badge.textContent=`v${config.appVersion}`;
  }

  window.applyAsmrtubeVersion=applyVersion;

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',applyVersion,{once:true});
  else applyVersion();
})();
