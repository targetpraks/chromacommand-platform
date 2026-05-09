# Maio OrbStack Deploy — ChromaCommand Makefile
# Usage: make deploy | make on | make off | make status | make seed

NAMESPACE := chromacommand

.PHONY: build deploy on off status seed clean

build:
	docker build -f docker/Dockerfile.api         -t chromacommand-api:latest .
	docker build -f docker/Dockerfile.dashboard   -t chromacommand-dashboard:latest .
	docker build -f docker/Dockerfile.edge-gateway -t chromacommand-edge-gateway:latest .

deploy:
	kubectl apply -f k8s/namespace.yaml
	kubectl apply -f k8s/secrets.yaml
	kubectl apply -f k8s/postgres-statefulset.yaml
	kubectl apply -f k8s/redis-statefulset.yaml
	kubectl apply -f k8s/mqtt-deployment.yaml
	kubectl apply -f k8s/api-deployment.yaml
	kubectl apply -f k8s/dashboard-deployment.yaml
	kubectl apply -f k8s/edge-gateway-deployment.yaml

seed:
	kubectl apply -f k8s/db-seed-job.yaml
	kubectl wait --for=condition=complete job/db-seed -n $(NAMESPACE) --timeout=120s

kubectl delete job db-seed -n $(NAMESPACE) --ignore-not-found=true

on:
	kubectl scale deployment api --replicas=1 -n $(NAMESPACE)
	kubectl scale deployment dashboard --replicas=1 -n $(NAMESPACE)
	kubectl scale deployment edge-gateway --replicas=1 -n $(NAMESPACE)
	kubectl scale statefulset postgres --replicas=1 -n $(NAMESPACE)
	kubectl scale statefulset redis --replicas=1 -n $(NAMESPACE)
	kubectl scale deployment mqtt --replicas=1 -n $(NAMESPACE)

off:
	kubectl scale deployment api --replicas=0 -n $(NAMESPACE)
	kubectl scale deployment dashboard --replicas=0 -n $(NAMESPACE)
	kubectl scale deployment edge-gateway --replicas=0 -n $(NAMESPACE)
	kubectl scale statefulset postgres --replicas=0 -n $(NAMESPACE)
	kubectl scale statefulset redis --replicas=0 -n $(NAMESPACE)
	kubectl scale deployment mqtt --replicas=0 -n $(NAMESPACE)

status:
	kubectl get pods -n $(NAMESPACE)
	kubectl get svc -n $(NAMESPACE)
	kubectl get ingress -n $(NAMESPACE)
	kubectl get pvc -n $(NAMESPACE)

clean:
	kubectl delete namespace $(NAMESPACE) --ignore-not-found=true
