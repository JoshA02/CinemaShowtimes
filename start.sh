#!/bin/bash
{
  npm run back-prod
}&
npm run front-build
cd public
npx serve -s build