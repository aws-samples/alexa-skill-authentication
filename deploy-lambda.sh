sam package --template-file template-Dev.yaml --s3-bucket secure.alexa.skill --output-template-file packagedDev.yaml
aws cloudformation deploy --template-file ${PWD}/packagedDev.yaml --stack-name BusinessResultsSkill --capabilities CAPABILITY_IAM
