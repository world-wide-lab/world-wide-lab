# Getting Started with World-Wide-Lab

::: warning
World-Wide-Lab is currently in beta, so we might still be tweaking a few things here and there. Feel free to [reach out to us](mailto:wwl@simson.io) if you want to start using it for a project and we can help you get started!
:::

## Desktop Application

The easiest way to get started with World-Wide-Lab is to use the Desktop Application which automatically includes everything you will need to run your own local experiments. The Desktop App is available for Windows, Mac, and Linux and can be [⬇️ downloaded here](https://github.com/world-wide-lab/world-wide-lab/releases/latest).

::: info
Even if you plan to use the World-Wide-Lab Server, we recommend to try out the Desktop Application first to get to know the platform, before setting up an online server.
:::

When starting World-Wide-Lab for the first time, you will be greeted with the welcome screen looking something like this.

![A screenshot of the dashboard pane in World-Wide-Lab](/img/screenshots/generated/admin.png){.screenshot}

### Trying it Out 🚀

If you want to give World-Wide-Lab a try, you can download our [jsPsych example study](https://github.com/world-wide-lab/world-wide-lab/blob/main/examples/study-jsPsych/index.html) and open it in your browser (make sure to also download the two images and put them in a folder "img" or use the [online version](https://world-wide-lab.github.io/world-wide-lab/examples/study-jsPsych/index.html)).

You should see data pop up in the `example` study in World-Wide-Lab as you play through the experiment.

::: info
If you're curious how hard it is to integrate World-Wide-Lab with a study, you can take a look at the [commit where we enabled World-Wide-Lab](https://github.com/world-wide-lab/world-wide-lab/commit/b584d892f421b008302139314d737f7cadc03fbf) for the official jsPsych example study, it's barely more than 5 lines of code!
:::

## Your First Study

All projects or experiments on World-Wide-Lab are organized into `Studies`.

The first step when setting up a new data collection is therefore to create a new study. To do so, go to _Studies_ in the left navigation pane (you may have to click the hamburger menu in the top left corner for the navigation to open) and click on the button **Create new** on the studies page.

![A screenshot of the studies view in World-Wide-Lab](/img/screenshots/generated/admin_resources_wwl_studies.png){.screenshot}

Provide a new `StudyId` to idenfity your study in the future and click on **Save** to create it. Each `Study Id` must be unique and should ideally have a clear link to your study, so you can remember it when downloading data later on. As an example, at [themusiclab.org](https://themusiclab.org) we often use abbreviations of the titles of our games as study ids e.g. `td` for the [Tone Deafness Test](https://www.themusiclab.org/quizzes/td/).

![A screenshot of the create new study view in World-Wide-Lab](/img/screenshots/generated/admin_resources_wwl_studies_actions_new.png){.screenshot}

With this, you just created your first study, well done! 🚀

::: info
If you want to provide additional information about your study, you can also add it under `Public Info` or `Private Info`.

Please note that everything under `Public Info` is indeed public and can be read by anyone without authentication, so please only use information there that you are comfortable sharing.
:::

## Collecting Data

Since World-Wide-Lab is currently mostly a back-end system for data collection, we do not focus on how to design and create the frond-end part of a Study. We recommend to use a library such as [jsPsych](https://www.jspsych.org/) to handle this part.

After creating the study in World-Wide-Lab, you will need to set up your experiment to send data to the study. How you will do this depends on how you created your experiment, since World-Wide-Lab supports different ways of collecting data.

On the `Studies` page, you should click the Study you just created to open its _Details_ page. There, you can see additional information about the Study and buttons to see or download its data. You will also find a section on `Integrating the Study` with code that you can paste into your experiment to set up data collection. To see how this code may look, you can also take a look at the [commit](https://github.com/world-wide-lab/world-wide-lab/commit/b584d892f421b008302139314d737f7cadc03fbf) in which we integrated the jsPsych example study with World-Wide-Lab.

![A screenshot of the create detailed view for a single study in World-Wide-Lab](/img/screenshots/generated/admin_resources_wwl_studies_records_my-awesome-study-id_show.png){.screenshot}

World-Wide-Lab has ready-made integrations for popular experimental libraries as well as a general purpose client library to support flexible use cases. Please refer to the detailed guides on the different integrations for more detailed information on how to set them up.

- [jsPsych](/guides/integration-jsPsych)
- lab.js *(coming soon)*
- [General Purpose Client](/guides/client)

With this in place, you are ready to start collecting data 🎉

::: tip
If you want to kick-start your own citizen science website you can also try our [simple starter template](https://github.com/world-wide-lab/world-wide-lab/blob/main/examples/website-static/) ([preview](https://world-wide-lab.github.io/world-wide-lab/examples/website-static/index.html)).
:::
