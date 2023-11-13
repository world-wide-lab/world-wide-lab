# What is World-Wide-Lab?

World-Wide-Lab is a platform to collect online data at scale, with a special focus on running online citizen science experiments.

World-Wide-Lab sits right in between web experiment libraries and data analysis software in the scope of running an online web study.

![A diagram showing the how World-Wide-Lab's role right in between libraries for experiment creation and data analysis software.](/img/diagrams/ecosystem.png)

You can create you web experiment or study using the library of your liking e.g. jsPsych or lab.js. Then you can put your study online and collect data in World-Wide-Lab, where data is stored inside a database. World-Wide-Lab is specifically created to avoid or handle common problems with online data collection, such as automatically scaling up resources to support a sudden increase in participants when e.g. your study is posted on a popular forum. When enough data has been collected, you can export your data from World-Wide-Lab with automatic pre-processing applied to save yourself some complicated data cleaning steps. Data is exported in standard formats, so any data analysis software is supported (e.g. R, Python, JASP, ...).

## The World-Wide-Lab Data Model

![A diagram showing the data-model, consisting of responses which belong to sessions.](/img/diagrams/data-model.png)

Data in World-Wide-Lab is organized into four different tables.

Whenever you wish to get started with a new study or experiment, you will first have to create a new `Study` on World-Wide-Lab. Every time someone participates in a study, their data is automatically organized into a new `Session`. Every time they answer even a single question or finish a task, a new `Response` is collected. Responses are collected individually and not in aggregate at the end of the study, to avoid potential data loss if someone only participates in part of a study. Linking `Participants` between studies and sessions is possible as well.
