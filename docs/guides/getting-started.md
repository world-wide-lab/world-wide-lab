# Getting Started with World-Wide-Lab

## Desktop Application

The easiest way to get started with World-Wide-Lab is to use the Desktop Application which automatically includes everything you will need to run your own local experiments. The Desktop App is available for Windows, Mac, and Linux and can be [⬇️ downloaded here](https://github.com/world-wide-lab/world-wide-lab/releases/latest).

::: tip
Even if you plan to use the World-Wide-Lab Server, we recommend to try out the Desktop Application first to get to know the platform, before setting up an online server.
:::

When starting World-Wide-Lab for the first time, you will be greeted with the welcome screen looking something like this.

![A screenshot of the dashboard pane in World-Wide-Lab](/img/screenshots/dashboard.png)

When you start up World-Wide-Lab for the first time, it will automatically generate an example study with some example data for you.

## Your First Study

All projects or experiments on World-Wide-Lab are organized into `Studies`.

The first step when setting up a new data collection is therefore to create a new study. To do so, go to *Studies* in the left navigation pane and click on the button **Created new** on the studies page.

Provide a new `StudyId` to idenfity your study in the future and click on **Save** to create it. Each `Study Id` must be unique and should ideally be clearly linked to your goal of the study, so you can remember it when downloading data later on.

With this, you just created your first study. 🚀

::: info
If you want to provide additional information about your study, you can also add it under `Public Info` or `Private Info`. Please note that everything under `Public Info` can be read by anyone without authentication, so please only use information there that you are comfortable sharing.
:::

## Collecting Data

After creating the study, you will need to set up your experiment to send data to the study. How you will do this depends on how you created your experiment, since World-Wide-Lab supports different ways of collecting data.

On the `Studies` page, you should select the Study you just created to open its *Show* page. There, you can see additional details about the Study and buttons to see or download its data. Below, you will find a section on `Integrating the Study`. This section has code that you can paste into the code of your experiment to set up data collection.

World-Wide-Lab supports ready-made integrations for popular experimental libraries e.g. jsPsych as well as a general purpose client library to support flexible use cases. Please refer to the detailed guides on the different integrations for more detailed information.

- [jsPsych](/guides/integration-jsPsych)
- [General Purpose Client]((/guides/client))

With this in place, you are ready to start collecting data. 🎉

We always recommend to test the quality of data collection before starting a large-scale data collection. To do so, just complete your experiment locally, [download its data](/guides/download-data) and see whether the data matches your expectations.

::: info
Since World-Wide-Lab is first and foremost a data-collection platform, experiments running on there need to be created using a different library. we recommend to use one of the libraries with integrations to create experiments such as [jsPsych](https://www.jspsych.org/).
:::