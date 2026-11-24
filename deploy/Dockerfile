FROM nginx:alpine
LABEL maintainer="im_arg"
LABEL description="mDiff Comparison Suite v7.0.0 - Mavenir Internal Web Deployment"

# Install custom nginx config with SPA routing and Gzip
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy production compiled web assets
COPY dist /usr/share/nginx/html

EXPOSE 80
STOPSIGNAL SIGQUIT
CMD ["nginx", "-g", "daemon off;"]
