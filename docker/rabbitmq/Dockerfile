# RabbitMQ with management plugin enabled
# Used as a private service on Render (not exposed to the internet)
FROM rabbitmq:3-management-alpine

# Enable the management UI (useful for debugging via Render shell)
RUN rabbitmq-plugins enable --offline rabbitmq_management

EXPOSE 5672 15672
