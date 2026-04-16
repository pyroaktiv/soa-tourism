package com.soa.blog_service.controller;

import com.soa.blog_service.client.FollowerGrpcClient;
import com.soa.blog_service.model.Blog;
import com.soa.blog_service.model.Comment;
import com.soa.blog_service.security.AuthInterceptor;
import com.soa.blog_service.service.BlogService;
import io.grpc.Status;
import io.grpc.stub.StreamObserver;
import org.springframework.stereotype.Controller;
import tourism.blog.v1.*;

import java.util.ArrayList;
import java.util.List;

@Controller
public class BlogGrpcController extends BlogServiceGrpc.BlogServiceImplBase {

    private final BlogService blogService;
    private final FollowerGrpcClient followerGrpcClient;

    public BlogGrpcController(BlogService blogService, FollowerGrpcClient followerGrpcClient) {
        this.blogService = blogService;
        this.followerGrpcClient = followerGrpcClient;
    }

    @Override
    public void createBlog(CreateBlogRequest request, StreamObserver<tourism.blog.v1.Blog> responseObserver) {
        Blog noviBlog = new Blog();

        String siguranAutorId = AuthInterceptor.USER_ID_KEY.get();
        noviBlog.setAuthorId(siguranAutorId);

        noviBlog.setTitle(request.getTitle());
        noviBlog.setDescription(request.getDescription());
        noviBlog.setImages(request.getImagesList());

        Blog sacuvanBlog = blogService.createBlog(noviBlog);

        responseObserver.onNext(mapToGrpcBlog(sacuvanBlog));
        responseObserver.onCompleted();
    }

    @Override
    public void getAllBlogs(GetAllBlogsRequest request, StreamObserver<GetAllBlogsResponse> responseObserver) {
        List<Blog> sviBlogovi = blogService.getAllBlogs(AuthInterceptor.USER_ID_KEY.get());

        GetAllBlogsResponse.Builder responseBuilder = GetAllBlogsResponse.newBuilder();

        for (Blog b : sviBlogovi) {
            responseBuilder.addBlogs(mapToGrpcBlog(b));
        }

        responseObserver.onNext(responseBuilder.build());
        responseObserver.onCompleted();
    }

    @Override
    public void addComment(AddCommentRequest request, StreamObserver<tourism.blog.v1.Blog> responseObserver) {
        String siguranAutorId = AuthInterceptor.USER_ID_KEY.get();
        String blogAuthorId = blogService.getBlogAuthorId(request.getBlogId());

        boolean following = followerGrpcClient.isFollowing(AuthInterceptor.USER_ID_KEY.get(), blogAuthorId).getIsFollowing();

        if(following || AuthInterceptor.ROLES.get().contains("admin")){
            Comment noviKomentar = new Comment();
            noviKomentar.setAuthorId(siguranAutorId);

            noviKomentar.setText(request.getComment().getText());

            Blog azuriranBlog = blogService.addComment(request.getBlogId(), noviKomentar);

            responseObserver.onNext(mapToGrpcBlog(azuriranBlog));
            responseObserver.onCompleted();
        }
        else {
            responseObserver.onError(Status.PERMISSION_DENIED.withDescription("Morate zapratiti autora da biste ostavili komentar.").asRuntimeException());
        }
    }
    @Override
    public void toggleLike(ToggleLikeRequest request, StreamObserver<tourism.blog.v1.Blog> responseObserver) {
        String siguranUserId = AuthInterceptor.USER_ID_KEY.get();

        Blog azuriranBlog = blogService.toggleLike(request.getBlogId(), siguranUserId);

        responseObserver.onNext(mapToGrpcBlog(azuriranBlog));
        responseObserver.onCompleted();
    }

    private tourism.blog.v1.Blog mapToGrpcBlog(Blog blog) {
        tourism.blog.v1.Blog.Builder builder = tourism.blog.v1.Blog.newBuilder()
                .setId(blog.getId() != null ? blog.getId() : "")
                .setAuthorId(blog.getAuthorId() != null ? blog.getAuthorId() : "")
                .setTitle(blog.getTitle() != null ? blog.getTitle() : "")
                .setDescription(blog.getDescription() != null ? blog.getDescription() : "")
                .setCreationDate(blog.getCreationDate() != null ? blog.getCreationDate().toString() : "")
                .addAllImages(blog.getImages() != null ? blog.getImages() : new ArrayList<>())
                .addAllLikedByUserIds(blog.getLikedByUserIds() != null ? blog.getLikedByUserIds() : new ArrayList<>());

        if (blog.getComments() != null) {
            for (Comment c : blog.getComments()) {
                builder.addComments(mapToGrpcComment(c));
            }
        }

        return builder.build();
    }

    private tourism.blog.v1.Comment mapToGrpcComment(Comment c) {
        return tourism.blog.v1.Comment.newBuilder()
                .setAuthorId(c.getAuthorId() != null ? c.getAuthorId() : "")
                .setText(c.getText() != null ? c.getText() : "")
                .setCreatedAt(c.getCreatedAt() != null ? c.getCreatedAt().toString() : "")
                .setLastModifiedAt(c.getLastModifiedAt() != null ? c.getLastModifiedAt().toString() : "")
                .build();
    }

}