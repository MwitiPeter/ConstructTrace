/**
 * Sample research corpus for local testing.
 * The texts are written to contain real definition sentences, measurement
 * items and quotations so the extraction + comparison pipeline can be
 * demonstrated end-to-end without uploading any PDF.
 *
 * Expected analysis results:
 *  - JINGLE: "Job satisfaction" is defined differently in papers 1 and 2.
 *  - JANGLE: "Job satisfaction" (paper 1) and "Employee satisfaction" (paper 3)
 *    are named differently but defined almost identically.
 */

export const SAMPLE_USER = {
  name: 'Demo Researcher',
  email: 'demo@constructtrace.app',
  password: 'demo1234',
};

export const SAMPLE_PROJECTS = [
  {
    key: 'main',
    name: 'Remote Work & Employee Wellbeing',
    description: 'Cross-paper construct audit for a systematic review of remote work studies.',
    researchQuestion: 'Do the papers in this review measure the same constructs under the same names?',
  },
  {
    key: 'empty',
    name: 'Digital Literacy in K-12 Classrooms',
    description: 'Second project left empty to demonstrate empty states.',
    researchQuestion: 'Which digital literacy constructs are used across K-12 studies?',
  },
];

export const SAMPLE_PAPERS = [
  {
    projectKey: 'main',
    title: 'Job Satisfaction in Remote Teams: An Empirical Study',
    authors: 'Chen, L. & Patel, R.',
    year: '2022',
    pages: [
      {
        page: 1,
        text: `The rapid shift toward remote work has prompted scholars to revisit established workplace constructs (Allen, 2020). In this study we examine how distributed teams experience attachment to their work.

Job satisfaction is defined as an emotional state that arises from an individual's appraisal of their job as fulfilling or exceeding expectations (Locke, 1976).

We assessed job satisfaction using a ten-item scale adapted from Spector (1985). Items such as "I feel satisfied with my job" and "My work is consistently enjoyable" were rated on a five-point Likert scale ranging from 1 (strongly disagree) to 5 (strongly agree).

Prior studies link job satisfaction with organizational commitment and reduced withdrawal behavior (Smith and Jones, 2019).`,
      },
      {
        page: 2,
        text: `Participants reported moderate job satisfaction (M = 3.82, SD = 0.71). Cronbach's alpha for the job satisfaction scale was .89, indicating acceptable reliability.

Remote employees reported slightly higher job satisfaction than office-based employees (t = 2.14, p < .05).

Limitations include a cross-sectional design, a single-source survey, and a sample concentrated in the technology sector.`,
      },
    ],
  },
  {
    projectKey: 'main',
    title: 'Equity and Fairness at Work',
    authors: 'Rivera, M.',
    year: '2021',
    pages: [
      {
        page: 1,
        text: `This paper examines fairness perceptions among knowledge workers in hybrid organizations.

Job satisfaction is defined here as the ratio of accumulated rewards to accumulated contributions that determines how fairly an employee is treated relative to others (Adams, 1965).

We measured job satisfaction with the six-item Equity Sensitivity Instrument. Items such as "I am fairly rewarded for what I contribute to my job" were completed by 214 respondents on a seven-point scale.`,
      },
      {
        page: 2,
        text: `Equity perceptions mediated the relationship between pay transparency and trust in management (beta = .31, p < .01).

Future research should replicate these results in non-Western samples and across industries.`,
      },
    ],
  },
  {
    projectKey: 'main',
    title: 'Employee Wellbeing and Retention in Healthcare',
    authors: 'Okafor, A.',
    year: '2023',
    pages: [
      {
        page: 1,
        text: `Retention of clinical staff remains a priority for hospital administrators. This paper studies the emotional and attitudinal drivers of retention.

Employee satisfaction refers to an emotional state arising from a worker's appraisal of their work fulfilling or exceeding expectations.

Employee satisfaction was assessed using four items including "I am satisfied with my work" on a seven-point scale. Cronbach's alpha was .84.

Intent to leave was measured using a three-item scale. Items such as "I often think about quitting my job" were rated by 168 nurses (Mobley, 1977).`,
      },
      {
        page: 2,
        text: `Employee satisfaction correlated negatively with intent to leave (r = -.46, p < .01).

Managerial implications: hospitals should monitor satisfaction trends quarterly and pair exit interviews with stay interviews.`,
      },
    ],
  },
];
