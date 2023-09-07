# Downloading Data

To download data for a Study on World-Wide-Lab go to the list of Studies on the left sidebar. There, hover your mouse over the button with the three dots `...` to see additional actions and click the option `Download Data`.

Alternatively, you can also click a study in the list of studies to open it's details page where there's another button titled `Download Data from this Study`.

Both of these options bring you to the `Download Data` view.

## Data Types

World-Wide-Lab allows you to download your data in a variety of different types and formats. Data types specify which kind of data is downloaded, whereas data formats specify in which format the data is prepared without affecting its actual contents.

The following data types are supported:

- **Responses (extracted)**: These are all responses belonging to a study with the keys of the response-payload extracted into different columns. This is the recommended format for further analyses as it makes working with data significantly easier.
- **Responses (unprocessed)**: These are all responses belonging to a study in their raw format. This data format is very similar to how other tools store experimental data, especially from web experiment libraries.
- **Runs (unprocessed)**: This is a list of all runs belonging to study, without their respective responses. This data format is useful if you want to examine private or public info stored in a run.
- **Participants (unprocessed)**: This is a list of all participants belonging to study, without their respective responses or runs. This data format is useful if you want to examine private or public info stored in a participant or if you have set up participant-links.

::: tip
If you are unsure about the differences between `Responses`, `Runs` and `Participants` we recommend reading the [What is World-Wide-Lab guide](/guides/what-is-world-wide-lab.md)
:::

The following data formats are supported:

- **JSON**: Javascript Object Notation
- **CSV**: Comma Separated Values (Recommended for further analyses)
