const path = require("path");
const jsonServer = require("json-server");
const server = jsonServer.create();
const data = require(path.join(__dirname, "data.json"));
const port = process.env.PORT || 4000;

server.listen(port, () => {
	console.log("JSON Server is running");
});

// CORS fix
server.use((req, res, next) => {
	res.header("Access-Control-Allow-Origin", "*");
	res.header("Access-Control-Allow-Headers", "*");
	next();
});

server.use(jsonServer.bodyParser);

// Survey handlers - HTTP GET returns data, anything else should return 500
server.get("/api/v1/survey", (req, res) => {
	res.json(data.survey);
});

server.all("/api/v1/survey", (req, res) => {
	res.status(500).json(data.errors.internalServerError);
});

// Survey answers handlers
server.post("/api/v1/survey/:id/answers", (req, res) => {
	console.log(req.body);

	// Get body from request
	const body = req.body;
	const answers = body.data?.attributes?.answers;

	if (!answers) {
		res.status(500).json({ error: "No answers given." });
	}

	// In case of errors, this should not be empty!
	const errors = [];

	// Imagine this is being fetched!
	const survey = data.survey.data;
	const questions = survey.attributes.questions; // Array of questions with types of inputs

	// validation
	questions?.forEach((question) => {
		if (question.required) {
			const answer = answers.find(
				(ans) => ans.questionId === question.questionId
			);

			// If there is no answer, add an error!
			if (!answer) {
				errors.push(
					buildError(
						`data/attributes/answers/${question.questionId}`,
						"The value is required."
					)
				);
				return;
			}

			let isValid = true;

			switch (question.questionType) {
				case "text":
					isValid = validateTextInput(answer.answer);
					break;
				case "rating":
					isValid = validateRatingInput(answer.answer, question.attributes);
					break;
				default:
					break;
			}

			if (!isValid) {
				errors.push(
					buildError(
						`data/attributes/answers/${question.questionId}`,
						`The value for ${question.questionId} is invalid.`
					)
				);
			}
		}
	});

	if (errors.length > 0) {
		res.status(422).json({ errors });
	} else {
		const id = Math.random().toString();
		res.status(201).json({
			data: {
				type: "surveyAnswers",
				id: id,
				attributes: {
					answers: answers,
				},
				relationships: {
					survey: {
						data: {
							type: "surveys",
							id: req.params.id,
						},
					},
				},
			},
		});
	}
});

const validateTextInput = (value) => {
	return value !== null && value !== undefined && value.trim() !== "";
};

const validateRatingInput = (value, attributes) => {
	const doesValueExist = value !== null && value !== undefined;

	if (!attributes) {
		return doesValueExist;
	} else {
		// If no value exists, but attributes exist
		if (!doesValueExist) {
			return false;
		} else {
			// Pretend the value is CORRECT, then check it additionally
			let isValueMoreThanMin = true;
			let isValueLessThanMax = true;

			if (attributes.min !== null && attributes.min !== undefined) {
				isValueMoreThanMin = value >= attributes.min;
			}
			if (attributes.max !== null && attributes.max !== undefined) {
				isValueLessThanMax = value <= attributes.max;
			}

			// Both validations have to be true
			return isValueMoreThanMin && isValueLessThanMax;
		}
	}
};

const buildError = (pointer, detail) => {
	return { source: { pointer }, detail };
};
