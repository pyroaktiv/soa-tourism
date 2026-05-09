package com.soa.blog_service.controller;

import com.soa.blog_service.client.AuthGrpcClient;
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
    private final AuthGrpcClient authGrpcClient;

    public BlogGrpcController(BlogService blogService, FollowerGrpcClient followerGrpcClient, AuthGrpcClient authGrpcClient) {
        this.blogService = blogService;
        this.followerGrpcClient = followerGrpcClient;
        this.authGrpcClient = authGrpcClient;
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

        responseObserver.onNext(mapToGrpcBlog(sacuvanBlog, true));
        responseObserver.onCompleted();
    }

    @Override
    public void getAllBlogs(GetAllBlogsRequest request, StreamObserver<GetAllBlogsResponse> responseObserver) {
        String requesterId = AuthInterceptor.USER_ID_KEY.get();
        List<Blog> sviBlogovi = blogService.getAllBlogs();

        List<String> followedIds = new ArrayList<>();
        boolean isAdmin = false;

        if (requesterId != null && !requesterId.isEmpty()) {
            isAdmin = AuthInterceptor.ROLES.get().contains("admin");
            try {
                followedIds = followerGrpcClient.getFollowedUserIds(requesterId).getUserIdsList();
            } catch (Exception e) {
            }
        }

        GetAllBlogsResponse.Builder responseBuilder = GetAllBlogsResponse.newBuilder();

        for (Blog b : sviBlogovi) {
            boolean canRead = false;
            if (isAdmin || b.getAuthorId().equals(requesterId) || followedIds.contains(b.getAuthorId())) {
                canRead = true;
            }
            responseBuilder.addBlogs(mapToGrpcBlog(b, canRead));
        }

        responseObserver.onNext(responseBuilder.build());
        responseObserver.onCompleted();
    }

    @Override
    public void getBlog(GetBlogRequest request, StreamObserver<tourism.blog.v1.Blog> responseObserver) {
        try {
            Blog pronadjenBlog = blogService.getBlogById(request.getId());
            String requesterId = AuthInterceptor.USER_ID_KEY.get();

            boolean canRead = false;
            if (requesterId != null && !requesterId.isEmpty()) {
                boolean isAdmin = AuthInterceptor.ROLES.get().contains("admin");
                boolean isAuthor = pronadjenBlog.getAuthorId().equals(requesterId);
                boolean isFollowing = followerGrpcClient.isFollowing(requesterId, pronadjenBlog.getAuthorId()).getIsFollowing();
                canRead = isAdmin || isAuthor || isFollowing;
            }

            responseObserver.onNext(mapToGrpcBlog(pronadjenBlog, canRead));
            responseObserver.onCompleted();
        } catch (RuntimeException e) {
            responseObserver.onError(Status.NOT_FOUND.withDescription(e.getMessage()).asRuntimeException());
        }
    }

    @Override
    public void addComment(AddCommentRequest request, StreamObserver<tourism.blog.v1.Blog> responseObserver) {
        String siguranAutorId = AuthInterceptor.USER_ID_KEY.get();
        String blogAuthorId = blogService.getBlogAuthorId(request.getBlogId());

        boolean following = followerGrpcClient.isFollowing(AuthInterceptor.USER_ID_KEY.get(), blogAuthorId).getIsFollowing();

        if(following || siguranAutorId.equals(blogAuthorId) || AuthInterceptor.ROLES.get().contains("admin")){
            Comment noviKomentar = new Comment();
            noviKomentar.setAuthorId(siguranAutorId);

            noviKomentar.setText(request.getComment().getText());

            Blog azuriranBlog = blogService.addComment(request.getBlogId(), noviKomentar);

            responseObserver.onNext(mapToGrpcBlog(azuriranBlog, true));
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

        responseObserver.onNext(mapToGrpcBlog(azuriranBlog, true));
        responseObserver.onCompleted();
    }

    private tourism.blog.v1.Blog mapToGrpcBlog(Blog blog, boolean canRead) {
        tourism.blog.v1.Blog.Builder builder = tourism.blog.v1.Blog.newBuilder()
                .setId(blog.getId() != null ? blog.getId() : "")
                .setAuthorId(blog.getAuthorId() != null ? blog.getAuthorId() : "")
                .setTitle(blog.getTitle() != null ? blog.getTitle() : "")
                .setCreationDate(blog.getCreationDate() != null ? blog.getCreationDate().toString() : "")
                .addAllLikedByUserIds(blog.getLikedByUserIds() != null ? blog.getLikedByUserIds() : new ArrayList<>())
                .setCanRead(canRead);

        String authorUsername = authGrpcClient.getUsername(blog.getAuthorId());
        builder.setAuthorUsername(authorUsername);

        if (canRead) {
            builder.setDescription(blog.getDescription() != null ? blog.getDescription() : "");
            builder.addAllImages(blog.getImages() != null ? blog.getImages() : new ArrayList<>());
            if (blog.getComments() != null) {
                for (Comment c : blog.getComments()) {
                    builder.addComments(mapToGrpcComment(c));
                }
            }
        } else {
            builder.setDescription("*Sadržaj ovog bloga je zaključan. Zaprati autora da bi ga pročitao!* 🔒");
        }

        return builder.build();
    }

    private tourism.blog.v1.Comment mapToGrpcComment(Comment c) {
        return tourism.blog.v1.Comment.newBuilder()
                .setAuthorId(c.getAuthorId() != null ? c.getAuthorId() : "")
                .setAuthorUsername(authGrpcClient.getUsername(c.getAuthorId()))
                .setText(c.getText() != null ? c.getText() : "")
                .setCreatedAt(c.getCreatedAt() != null ? c.getCreatedAt().toString() : "")
                .setLastModifiedAt(c.getLastModifiedAt() != null ? c.getLastModifiedAt().toString() : "")
                .build();
    }

}