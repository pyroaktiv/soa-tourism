package com.soa.blog_service.controller;

import com.soa.blog_service.model.Blog;
import com.soa.blog_service.service.BlogService;
import io.grpc.stub.StreamObserver;
import org.springframework.stereotype.Controller;
import tourism.blog.v1.BlogServiceGrpc;
import tourism.blog.v1.CreateBlogRequest;

@Controller
public class BlogGrpcController extends BlogServiceGrpc.BlogServiceImplBase {

    private final BlogService blogService;

    public BlogGrpcController(BlogService blogService) {
        this.blogService = blogService;
    }

    @Override
    public void createBlog(CreateBlogRequest request, StreamObserver<tourism.blog.v1.Blog> responseObserver) {

        Blog noviBlog = new Blog();
        noviBlog.setAuthorId(request.getAuthorId());
        noviBlog.setTitle(request.getTitle());
        noviBlog.setDescription(request.getDescription());
        noviBlog.setImages(request.getImagesList());

        Blog sacuvanBlog = blogService.createBlog(noviBlog);

        tourism.blog.v1.Blog grpcOdgovor = tourism.blog.v1.Blog.newBuilder()
                .setId(sacuvanBlog.getId())
                .setAuthorId(sacuvanBlog.getAuthorId())
                .setTitle(sacuvanBlog.getTitle())
                .setDescription(sacuvanBlog.getDescription())
                .setCreationDate(sacuvanBlog.getCreationDate().toString())
                .addAllImages(sacuvanBlog.getImages())
                .build();

        responseObserver.onNext(grpcOdgovor);
        responseObserver.onCompleted();
    }
}