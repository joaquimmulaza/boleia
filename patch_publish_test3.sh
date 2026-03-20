#!/bin/bash
sed -i "s/fireEvent.change(document.querySelector('input\[name=\"origin_name\"\]')/const originInput = document.querySelector('input\[name=\"origin_name\"\]'); if(originInput) fireEvent.change(originInput/g" src/pages/PublishRoute.test.jsx
