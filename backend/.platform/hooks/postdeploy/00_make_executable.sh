#!/bin/bash

# Make all scripts in postdeploy executable
# Elastic Beanstalk runs these as root
chmod +x /var/app/current/.platform/hooks/postdeploy/*.sh
